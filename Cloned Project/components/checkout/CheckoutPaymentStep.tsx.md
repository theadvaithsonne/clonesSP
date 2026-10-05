# `components/checkout/CheckoutPaymentStep.tsx`

> The shared "pay this invoice" step: loads an invoice, shows it, offers coupons and payment methods, and drives the Razorpay, Stripe, wallet and crypto payment flows through to success.

**Kind:** React component · **Lines:** 941

## Purpose
Almost every sellable thing in Garage (courses, workshops/webinars, products, services, calls, channels, events, licences, standalone invoices) is paid for the same way: the backend creates an `Invoice`, and the frontend renders this component with its id. It is the single orchestrator between the invoice API (`/backend/api/invoices/*`), the method picker (`PaymentMethodSelector`), the inline crypto deposit panel (`CryptoPaymentPanel`), and the Razorpay Standard Checkout popup. Host pages only supply the invoice id, buyer details and an `onSuccess` callback.

## How it works

### Loading the invoice (L137-L255)
- On mount and whenever `invoiceId` changes, `fetchInvoice()` calls `GET /backend/api/invoices/:invoiceId` (no auth header). It stores `data.invoice` and `data.upiAutopayNotice` (the server-computed UPI Autopay disclosure; the frontend never computes renewal prices itself).
- Render states: spinner while loading; an error card with "Try Again" if the fetch fails and no invoice is loaded; a "Verifying payment..." screen while `verifying` is true.

### Crypto-pending state and polling (L121-L236)
- `cryptoPending` means the buyer has started a crypto payment and the page is waiting for the backend to mark the invoice paid. `cryptoRequest` holds the in-house deposit request (address, amount, coin, chain, chainName, expiresAt).
- After a page refresh, an effect turns `cryptoPending` back on when the invoice is `pending`, its `paymentMethodCategory` is `crypto`, and `metadata.nowpaymentsInvoiceId` is set (the legacy NOWPayments case).
- While pending, a polling loop re-fetches `GET /backend/api/invoices/:invoiceId`. The first poll runs after 5 s, then every 10 s for the first 30 attempts, every 30 s until attempt 80, then every 60 s. `paid` clears state, toasts and calls `onSuccess({ invoiceNumber })`. `failed`, `expired`, `refunded` or `cancelled` stop the loop and show an error. Network errors are ignored and polling continues.
- While pending, a `beforeunload` guard warns the buyer before they leave the page, because leaving loses the QR code and deposit address they just paid to.

### Starting a payment: `handlePaymentInitiated` (L282-L439)
This handler is passed to `PaymentMethodSelector`, which calls it with the result of `POST /backend/api/invoices/:id/select-payment` and similar endpoints. It checks the result in this order:
1. **`walletPaid` / `stripePaid` / `alreadyPaid`:** the payment is already complete on the server. It toasts and calls `onSuccess` with the invoice number.
2. **`cryptoRequest`:** the in-house crypto flow. It stores the request, sets `cryptoPending`, and the inline `CryptoPaymentPanel` appears.
3. **`cryptoPaymentUrl`:** the legacy NOWPayments hosted page. It opens the URL in a new tab and sets `cryptoPending`. The comment says to remove this branch once `/webhooks/nowpayments` traffic reaches zero.
4. **`razorpayOrderId` + `razorpayKeyId`:** it loads `https://checkout.razorpay.com/v1/checkout.js` once (`loadRazorpaySdk`, which polls for `window.Razorpay` for up to 5 s) and opens Standard Checkout with:
   - the order id, amount, currency, org name and first line-item name;
   - the saved-card options returned by the backend: `customer_id`, `save: 1` with `remember_customer`, and a preferred `token`;
   - `recurring: 1` only when the backend set `upiAutopay` (Razorpay needs this to register a UPI Autopay mandate);
   - `prefill.contact` from the `userPhone` prop via `formatRazorpayContact`, falling back to `getRazorpayContactForCurrentUser()` (which reads `/profile` and caches it per session). This skips Razorpay's "enter mobile" step.
5. **No branch matches:** it shows a loud error and logs the response to the console instead of failing silently.

### Razorpay verification (L441-L472)
The Razorpay `handler` sends `{ razorpayOrderId, razorpayPaymentId, razorpaySignature }` to `POST /backend/api/invoices/:invoiceId/verify-payment`. On success it calls `onSuccess({ invoiceNumber, paymentId })`. If the popup is dismissed, it only shows a "Payment cancelled" toast.

### Coupons and cashback (L570-L677)
- If the invoice already has a coupon with a discount, a green "Coupon X applied" badge shows. If it has `cashbackCodeId`, an amber badge says the cashback credit lands in the store wallet after purchase.
- Otherwise `PlatformCouponInput` is shown only when all of these hold:
  - the first line item's `itemType` maps to a coupon product type via `couponProductTypeForItem`;
  - the invoice has no coupon or cashback yet;
  - the user is logged in (`getToken()`);
  - the invoice status is `draft` or `pending`.
- Renewals accept coupons too.
- On apply, it calls `POST /backend/api/invoices/:invoiceId/apply-platform-coupon` with the Bearer token and `{ code }`, then re-fetches the invoice. Errors are re-thrown so the input does not show a discount the invoice never received.

### Choosing a method (L708-L814)
- **Zero-total invoices:** a single "Confirm — Activate" button posts a stub `select-payment` (`paymentMethodCategory: "card"`, `paymentPlatform: "razorpay"`). The backend short-circuits zero totals and returns `alreadyPaid`.
- **Everything else:** renders `PaymentMethodSelector` with:
  - `upiAutopayNotice`;
  - `paymentChannel` set to `"crypto"` when `invoice.metadata.paymentChannel === "crypto"` (HiFi USDC/USDT invoices), otherwise `"any"`;
  - `walletCurrencyLock` from `invoice.metadata.allowedWalletCurrencies`.
- While an in-house crypto request is active, the selector is blurred, made non-interactive and marked `aria-hidden`, so the buyer cannot start a second payment.

### Inline crypto panel (L816-L889)
Shown below the selector when `cryptoPending && cryptoRequest`. It sits below on purpose, so mobile buyers see the chain they picked before the QR code. Its `onRegenerate` posts `select-payment` again with the same `chain`/`coin` (`paymentPlatform: "crypto_wallet"`) and replaces `cryptoRequest` with the new address. Backend idempotency reuses a deposit address that is still valid.

### Cancelling (L474-L507, L891-L937)
- `handleCancel` calls `POST /backend/api/invoices/:invoiceId/cancel` directly.
- When crypto is pending, it first opens a themed `AlertDialog` warning that crypto already sent cannot be refunded. "Cancel anyway" then calls the endpoint with `?force=true`.
- A `409` response means a crypto payment may be in flight; the error is toasted and the page stays.
- On any other result, including network errors, it clears pending state and calls `onCancel`, so the user is never stuck.

## Exports
- `CheckoutPaymentStep(props)`: named export, client component. Props:
  - `invoiceId: string`: invoice `_id`.
  - `organizationName: string`: seller name for the Razorpay popup.
  - `userEmail: string`, `userName?: string`, `userPhone?: string`: buyer prefill. The phone may be bare digits (treated as +91) or E.164.
  - `isSubscription?: boolean`: changes the zero-total button label only.
  - `country?: string`: passed to the selector for region-based options.
  - `onSuccess({ invoiceNumber, paymentId?, token?, orgId? })`: called once payment completes.
  - `onCancel?()`, `onBack?()`: optional cancel link and back link.
  - `showInvoicePreview?: boolean` (default `true`): hides `InvoicePreview` for hosts that already show the order.

## Interfaces
- **Backend endpoints called:**
  - `GET /backend/api/invoices/:invoiceId`: invoice plus `upiAutopayNotice`; also used for polling.
  - `POST /backend/api/invoices/:invoiceId/select-payment`: zero-total confirm and crypto address regeneration. The selector calls it for normal payments.
  - `POST /backend/api/invoices/:invoiceId/verify-payment`: Razorpay signature verification.
  - `POST /backend/api/invoices/:invoiceId/apply-platform-coupon`: apply a coupon (Bearer token).
  - `POST /backend/api/invoices/:invoiceId/cancel[?force=true]`: cancel the invoice.
- **External services:** Razorpay Standard Checkout script (`checkout.razorpay.com`); NOWPayments hosted page (legacy branch only).
- **Browser storage / cookies:** auth token via `getToken()`. `getRazorpayContactForCurrentUser` keeps its own sessionStorage cache.
- **Background work:** adaptive `setTimeout` polling while crypto is pending; a `beforeunload` listener.

## Dependencies
- **Internal:**
  - `components/checkout/PaymentMethodSelector.tsx`: method picker.
  - `components/checkout/CryptoPaymentPanel.tsx`: deposit QR panel.
  - `components/checkout/InvoicePreview.tsx`: invoice summary and the `InvoiceData` type.
  - `components/ui/platform-coupon-input.tsx`: coupon input and `couponProductTypeForItem`.
  - `components/ui/alert-dialog.tsx`, `components/ui/button.tsx`: UI primitives.
  - `lib/api.ts`: `API_URL`.
  - `lib/auth.ts`: `getToken`.
  - `lib/razorpayPrefill.ts`: phone prefill helpers.
- **Packages:** `react` (state and effects), `lucide-react` (icons), `sonner` (toasts).

## Used by
`app/(onboarding)/upgrade/page.tsx`, `app/checkout/{call,channel,course,product,service,workshop}/[...]/*CheckoutPage.tsx`, `app/invoice/[invoiceId]/InvoicePayPage.tsx`, `components/dashboard/ProductsPage.tsx`, `components/dashboard/WorkshopsPage.tsx`, `components/dashboard/inlineApps/events/EventCheckoutView.tsx`, `components/onboarding/UnilevelLicenceGate.tsx`, `components/webinar/WebinarCheckoutDialog.tsx`, `components/webinar/WebinarPreJoin.tsx` (14 importers in total).

## Notes
- The invoice GET, verify, cancel and polling calls send no auth header. The backend treats invoice ids as bearer-style links (guest invoice pay).
- `onSuccess` is a dependency of the polling effect. A host that passes a new inline function on every render restarts the poll timer each time.
- The legacy NOWPayments branch and banner are marked for removal.
- `CheckCircle2` and `Tag` are imported in a second `lucide-react` import statement (L27). This is harmless.
