# `components/checkout/PaymentMethodSelector.tsx`

> The two-step payment picker used across the app: step 1 picks a currency or crypto, step 2 picks a method (card, UPI, saved card or store vault). It then starts the payment against the invoice API and hands the result to its parent.

**Kind:** React component · **Lines:** 1850

## Purpose
Every invoice-backed purchase eventually reaches this component, either inside `CheckoutPaymentStep` or embedded directly in dashboard surfaces (wallet top-ups, subscriptions, channel payments, OpenClaw billing, BAT246 boards and others).

It hides the complexity of a multi-gateway checkout:
- the backend decides which currencies and methods are offered;
- Stripe handles cards, both fresh and saved, with 3DS;
- Razorpay handles INR UPI (and legacy cards), including saved tokens and UPI Autopay;
- store-vault balances can pay instantly;
- crypto uses the in-house chain/coin flow.

The component never marks anything paid itself. It calls backend endpoints and reports the outcome through `onPaymentInitiated` or `onError`.

## How it works

### Props and configuration (L36-L289)
- `PaymentMethodSelectorProps`:
  - `invoiceId`, `itemCurrency`, and `totalAmount` (minor units);
  - optional `country`;
  - `paymentChannel` (`"any"` | `"crypto"`): crypto-only invoices skip fiat and wallets;
  - `walletCurrencyLock`: from `invoice.metadata.allowedWalletCurrencies`;
  - `upiAutopayNotice`: server-computed mandate disclosure;
  - `onPaymentInitiated`, `onError`, `customerEmail`, `disabled`.
- `PAYMENT_TYPE_CONFIG` builds one tile per entry in `CHECKOUT_FIAT_CURRENCIES` (from `lib/checkout-currencies.ts`), plus a `crypto` tile. The crypto tile's sublabel is replaced at render time by the live chain list.
- `METHOD_CONFIG` holds the label, icon and gradient for `card`, `upi` and `store_wallet`.
- `CryptoChainOption`: `{ chain: tron|polygon|bsc|ethereum|bitcoin, coin: USDT|USDC|ETH|BTC|POL, label, chainName }`.
- **Direct UPI intent constants (L214-L267):** `DIRECT_UPI_VPA`, `DIRECT_UPI_PAYEE_NAME` and `DIRECT_UPI_ALLOWED_EMAIL` are hardcoded at L223-L225. They are a personal UPI VPA and one buyer email; see Notes.
  - `UPI_INTENT_APPS` lists GPay, PhonePe, Paytm, and "Other". "Other" is Android-only and uses the generic `upi://` scheme.
  - `buildUpiIntentUrl()` builds the `pa`/`pn`/`am`/`cu=INR`/`tn` query string. The scheme is `tez://` (`gpay://` on iOS) for GPay, `phonepe://` for PhonePe and `paytmmp://` for Paytm.

### State (L292-L421)
- **Wizard state:** `step` (1|2), `loading`, `optionsLoading`, `currencies`, `methods` (per currency), `cryptoAvailable`, `cryptoChains`, `selectedCrypto`, `selectedType` (a currency code or `"crypto"`), `selectedMethod`.
- **FX state:** `exchangeRate` (USD→INR) and `fxRates` (the full USD table).
- **Wallets:** `wallets.stores`, `selectedStoreWalletOrgId`, `storeVaultExpanded`. A `selectedType` change clears the chosen store wallet, and the `store_wallet` method if it was chosen.
- **Stripe:**
  - `stripeIntent`: `{ clientSecret, publishableKey, paymentIntentId, amount, currency, savedCardFlow }`. Setting it switches the UI to the embedded `StripeCardForm`.
  - `savedCards`, `selectedSavedCardId`, `saveForFuture` (default on).
- **Razorpay saved cards:** `savedRazorpayTokens`, `selectedSavedRazorpayTokenId`, `saveRazorpayForFuture`.
- **Buyer profile:** `buyerProfile`, used to prefill Stripe billing details (needed by Stripe India for export transactions).
- **Autopay:** `autopayNotice = upiAutopayNotice ?? fetchedAutopayNotice`.
- `lastSentCryptoRef`: the last chain/coin successfully sent to the backend.

### Data loading on mount (L438-L643)
Six fetches run in parallel, once:
1. **`fetchPaymentOptions`:** `GET /backend/api/invoices/payment-options?invoiceId&country&amount&itemCurrency`.
   - Sets `currencies` and `methods`.
   - Crypto counts as available if any currency's method list has an enabled `crypto` entry.
   - It then fetches `GET /backend/api/invoices/crypto/chains`. An empty list or an error hides crypto.
   - Unless the invoice is crypto-only, it picks the initial currency: `itemCurrency` if offered (after applying `walletCurrencyLock`), otherwise the first offered currency.
   - If the call fails, it falls back to USD (Razorpay card) and INR (Razorpay card + UPI).
2. **`fetchExchangeRate`:** `GET https://open.er-api.com/v6/latest/USD` (external). Falls back to a USD→INR rate of 85 if the call fails.
3. **`fetchWalletBalances`:** logged-in users only. Calls `GET /backend/wallet/all?invoiceId=…`. The invoice hint lets the backend create the seller's cryptobrand sibling wallets (INR/ETH/BTC) on demand. Each `storeWallets` row becomes `{ orgId, orgName, orgIcon, balance, currency }`, with currency defaulting to USD.
4. **`fetchBuyerProfile`:** `GET /backend/auth/me` gives name, email, city, state, postal code and country.
5. **`fetchSavedCards`:** calls `listPaymentMethods()`, which is `GET /backend/payment-methods` via `lib/payment-methods-api.ts`. It returns Stripe methods and Razorpay tokens.
6. **`fetchAutopayNotice`:** only when the parent did not pass `upiAutopayNotice` at all (the prop is `undefined`). Calls `GET /backend/api/invoices/:invoiceId` and reads `upiAutopayNotice`. This exists so that no caller can accidentally hide the mandate disclosure; `WalletPageNew` once did exactly that for combo carts.

### Amount preview (L536-L562, L904-L922)
- `previewRate(from, to)` cross-rates through USD, the same way the backend's `convertCurrency` does.
- `getDisplayAmount()` converts `totalAmount` from `itemCurrency` into `selectedType` for display. The USD↔INR pair uses `exchangeRate` directly; other pairs use `fxRates`.
- `convertForDisplay()` applies the same conversion to autopay amounts, so the disclosed figure matches the Pay button.
- These previews are approximate (the Pay button shows a `~` when converted). The backend computes the real charge.

### Paying: `handlePayNow` (L645-L846)
1. **Store vault:** requires a token and a chosen vault. Posts `{ walletType: "store", orgId, currency }` to `POST /backend/api/invoices/:invoiceId/pay-with-wallet`. The backend debits and fulfils atomically. On success it reports `{ walletPaid: true }`. The Affiliate Vault stopped being a payment source on 19 Sep 2026.
2. **Crypto:** requires `selectedCrypto`. The request body is `{ paymentCurrency: itemCurrency, paymentMethodCategory: "crypto", paymentPlatform: "crypto_wallet", chain, coin }`.
3. **Saved Stripe card:** `{ paymentPlatform: "stripe", paymentMethodCategory: "card", savedPaymentMethodId }`. The backend attempts an off-session charge.
4. **Saved Razorpay token:** `{ paymentCurrency: "INR", paymentPlatform: "razorpay", savedRazorpayTokenId }`.
5. **Fresh method:**
   - The platform is the first enabled platform for the chosen method, defaulting to `razorpay`.
   - It adds `savePaymentMethodForFuture` for a Stripe card when the checkbox is ticked.
   - It adds `saveRazorpayCardForFuture` for an INR Razorpay card when that checkbox is ticked.

Cases 2-5 post to `POST /backend/api/invoices/:invoiceId/select-payment` (Bearer token when present). The response is handled as follows:
- **`alreadyPaid`:** the saved-card charge succeeded. It reports `{ stripePaid: true }`.
- **`stripeClientSecret`:** sets `stripeIntent`, which renders `StripeCardForm`. With `savedCardFlow` the form runs only the 3DS/OTP challenge; otherwise it shows full card entry.
- **Otherwise:** the raw response (Razorpay order, crypto request, legacy crypto URL and so on) is passed to `await onPaymentInitiated(data)`. The await is deliberate: an un-awaited async consumer once swallowed errors and left a dead Pay button for three weeks. After a successful crypto call, `lastSentCryptoRef` is stamped.

All errors go to `onError(message)`.

### Follow-up effects and handlers (L848-L902)
- **Crypto chain switch:** once a crypto address has been minted, picking a different chain or coin automatically calls `handlePayNow` again, so the QR code updates without a second click.
- **`handleUpiAppPay(app)`:** sets `window.location.href` to the UPI deep link, with the invoice id in the note.
- **`handleStripeSucceeded(paymentIntentId)`:** calls `POST /backend/api/invoices/:invoiceId/confirm-stripe-payment` with `{ paymentIntentId }`. On success it reports `{ stripePaid: true }`. A Stripe webhook (`server/routes/stripeWebhook.ts`) acts as a backstop.

### Derived lists (L924-L1007)
- **`paymentTypes`:**
  - Crypto-only invoices get just `["crypto"]`.
  - Otherwise: the backend currencies that this build knows (`isFiatCurrency`, so an unknown backend currency never renders a blank tile), filtered by `walletCurrencyLock`, plus `crypto` when available.
  - If only one type remains (and the invoice is not crypto-only), the wizard skips to step 2.
- **`fiatMethods`:** the selected currency's methods without `crypto`/`wallet` (wallets render separately).
- **`eligibleStoreWallets`:** store wallets whose currency equals the selected currency. A wallet can be chosen only if its balance is at least the display amount in major units.
- **`upiAppsMode`:** true only on mobile (`useIsMobile`), for an INR invoice paid in INR, with UPI chosen, and the customer email equal to `DIRECT_UPI_ALLOWED_EMAIL`. In that case the Pay button is replaced by the UPI app grid.

### Render (L1009-L1849)
- A loading spinner while options load.
- A step indicator ("Currency" → "Pay"), hidden in crypto mode.
- An amount header, with the conversion rate when the payment currency differs.
- **Step 1:**
  - a currency/crypto tile grid (two columns on mobile, three from `sm`);
  - in crypto mode, a "Choose network" grid of chain/coin buttons and a "Pay with {coin}" button;
  - otherwise a Continue button;
  - a security note.
- **Step 2 (fiat):**
  - a "Change payment option" link;
  - saved Stripe cards, filtered by issuer country: INR shows Indian cards, other currencies show non-Indian cards, and legacy rows without a country show everywhere;
  - saved Razorpay tokens (INR only);
  - method rows;
  - an expandable "Store Vault" row listing eligible vaults with balances and a "low" marker;
  - then one of: the embedded `StripeCardForm` (with "Use a different payment method"), the UPI app grid, or the save-card checkbox, UPI Autopay disclosure and Pay button.
- **UPI Autopay disclosure:** shown only for INR with UPI chosen, when a notice exists. It states today's charge and the renewal charge, or just the renewal charge, with the interval. There is no checkbox, because the buyer authorises the mandate in their UPI app.
- The Pay button label reflects the path: a vault name, "with saved card", or the converted amount.

## Exports
- `PaymentMethodSelector(props: PaymentMethodSelectorProps)`: named client component.
- `onPaymentInitiated` receives `{ razorpayOrderId?, razorpayKeyId?, razorpaySubscriptionId?, razorpayCustomerId?, razorpayPreferredTokenId?, razorpaySave?, upiAutopay?, shortUrl?, cryptoPaymentUrl?, walletPaid?, stripePaid?, amount, currency, invoiceId }` and may return a Promise.

## Interfaces
- **Backend endpoints called:**
  - `GET /backend/api/invoices/payment-options`: currencies and methods for the buyer's region.
  - `GET /backend/api/invoices/crypto/chains`: enabled chain/coin combinations.
  - `GET /backend/api/invoices/:invoiceId`: autopay notice fallback.
  - `POST /backend/api/invoices/:invoiceId/select-payment`: start a payment.
  - `POST /backend/api/invoices/:invoiceId/pay-with-wallet`: store-vault debit (requires auth).
  - `POST /backend/api/invoices/:invoiceId/confirm-stripe-payment`: confirm after Stripe succeeds.
  - `GET /backend/wallet/all?invoiceId=`: store wallet balances.
  - `GET /backend/auth/me`: buyer profile for Stripe billing.
  - `GET /backend/payment-methods`: saved Stripe cards and Razorpay tokens.
- **External services:**
  - `open.er-api.com`: exchange rates.
  - Stripe, via `StripeCardForm`.
  - Razorpay, opened by the parent.
  - UPI apps via deep links.
- **Browser storage / cookies:** the auth token via `getToken()`. Wallet balances, saved cards and profile are skipped for guests.

## Dependencies
- **Internal:**
  - `components/checkout/StripeCardForm.tsx`: embedded Stripe Elements form and saved-card 3DS view.
  - `lib/checkout-currencies.ts`: `CHECKOUT_FIAT_CURRENCIES`, `currencySymbol`, `formatMinor`, `isFiatCurrency`.
  - `lib/payment-methods-api.ts`: `listPaymentMethods` and the saved-method types.
  - `hooks/use-mobile.ts`: `useIsMobile`.
  - `lib/api.ts`: `API_URL`.
  - `lib/auth.ts`: `getToken`.
  - `lib/utils.ts`: `cn`.
  - `components/ui/button.tsx`.
- **Packages:** `react`, `lucide-react`.

## Used by
`components/checkout/CheckoutPaymentStep.tsx`, `app/(dashboard)/games/bat246/boards/page.tsx`, `components/dashboard/CallsPage.tsx`, `ChannelPaymentModal.tsx`, `ChannelPaymentModalNew.tsx`, `CoursesPage.tsx`, `OpenClawAgentTabs.tsx`, `OpenClawBillingPage.tsx`, `ServicesPage.tsx`, `SubscriptionPaymentModal.tsx`, `TopUpStoreWalletSheet.tsx` and `WalletPageNew.tsx` (12 importers in total).

## Notes
- **Hardcoded personal data (L223-L225):** a personal UPI VPA (containing a phone number) and a single allowed buyer email are in source. Direct-UPI payments bypass every gateway: money goes straight to that VPA's bank account, so the invoice is not marked paid automatically and must be reconciled by hand from the bank statement. The feature is gated to that one email address, and only on mobile.
- After a successful wallet payment, `currency: "USD"` is always reported, whatever the debited currency. The parent only uses the `walletPaid` flag.
- The crypto security note still reads "Secured by NOWPayments. 300+ cryptocurrencies." and the header says "Pay with any of 300+ cryptocurrencies", although the in-house flow offers only the listed chains.
- The Razorpay fresh-card save checkbox is described in the code as a dead path since INR cards moved to Stripe India. It is kept in case routing is reverted.
- FX previews come from a public API on the client and are display-only. The backend's conversion is authoritative.
