# `server/config/hifiInvoice.ts`

> Currency rules for HiFi investment invoices: which currencies are paid from store wallets, which through the on-chain crypto pipeline, and how the free-text currency on an application is normalised.

**Kind:** backend config · **Lines:** 125

## Purpose
HiFi investment products, applications, KYC, subscriptions and payouts live in `hifi_*` collections owned by a separate seller app (garage-seller-hifi). This backend adds an invoice and payment layer on top: on the "Pay" step, the seller frontend calls the invoice route to mint a Garage invoice, the investor pays it through the standard invoice page, and `services/hifiInvoiceFulfillment.ts` updates `hifi_investment_applications` / `hifi_investment_subscriptions` once paid. This file decides which payment channel an application's currency uses.

## How it works
- **Wallet channel:** `HIFI_WALLET_CURRENCIES = ["USD", "INR", "ETH", "BTC"]`, backed by the multi-currency store wallets (`services/cryptobrandWallets.ts`). The comment asks for this list and `CRYPTOBRAND_EXTRA_CURRENCIES` in `config/cryptobrandCurrencies.ts` to be extended together.
- **Crypto-invoice channel:** `HIFI_CRYPTO_INVOICE_CURRENCIES = ["USDC", "USDT"]`, paid on-chain to a platform address and matched by amount through the `CryptoPaymentRequest` pipeline. No one holds a USDC store-wallet balance. Each currency here must have at least one row with a populated address in `SUPPORTED_CHAINS` (`config/cryptoWallets.ts`), or minting the invoice returns 400.
- **`normalizeHifiCurrency(raw)`** turns the application's free-text currency (e.g. `"USDC"`, `"INR (₹)"`, `"USD ($)"`, `"USDT (BEP-20)"`) into a tagged result. It upper-cases, strips everything except A-Z, then checks in order: `USDC`/`USDT` prefixes -> `{ kind: "crypto" }` (checked first because "USDT" starts with "USD"); `INR`, `USD` prefixes, exact `ETH`, exact `BTC` -> `{ kind: "wallet" }`; otherwise `null`. A wallet result means the invoice gets an allowed-wallet-currency gate and the frontend shows the wallet tab; a crypto result means the invoice's payment channel is crypto and the crypto tab is shown.
- `HIFI_PAYABLE_CURRENCIES` concatenates both lists for error messages.
- `HifiApplicationDoc` is a minimal typing of the `hifi_investment_application` fields this backend touches (ids, `units`, `currency`, `payableInr`, payment status fields, step statuses, `walletCurrency`, `walletAmount`, etc.).

## Exports
- `HIFI_WALLET_CURRENCIES`, `type HifiWalletCurrency`.
- `HIFI_CRYPTO_INVOICE_CURRENCIES`, `type HifiCryptoInvoiceCurrency`.
- `type NormalizedHifiCurrency` - `{ kind: "wallet"; currency } | { kind: "crypto"; currency }`.
- `normalizeHifiCurrency(raw: string | undefined | null): NormalizedHifiCurrency | null`.
- `HIFI_PAYABLE_CURRENCIES` - every resolvable currency.
- `interface HifiApplicationDoc` - partial application document type (not imported anywhere else at present).

## Interfaces
- **Endpoints that use it:** `POST /backend/hifi/applications/:applicationId/invoice` (`routes/hifiInvoice.ts`, mounted at `/hifi`) normalises the currency and returns 400 listing `HIFI_PAYABLE_CURRENCIES` when it is not payable.
- **Database (described, not accessed here):** `hifi_investment_applications`, `hifi_investment_subscriptions`.

## Dependencies
None.

## Used by
- `server/routes/hifiInvoice.ts` (only importer).

## Notes
- Because non-letters are stripped, something like `"US Dollar"` becomes `USDOLLAR` and resolves to USD; any string starting with those letters is accepted.
