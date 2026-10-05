# `server/services/nowpayments.ts`

> NOWPayments crypto payment integration.

**Kind:** backend service · **Lines:** 273

<!-- docgen:auto -->

## Purpose
NOWPayments crypto payment integration.
Handles creating crypto payments and verifying IPN (webhook) signatures.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `CreateCryptoPaymentOptions` | interface |  | 29 |
| `CryptoPaymentResponse` | interface |  | 40 |
| `CryptoPaymentStatus` | interface |  | 57 |
| `CryptoMinAmount` | interface |  | 71 |
| `checkStatus` | function | `async checkStatus(): Promise<boolean>` — Check if NOWPayments API is available. | 83 |
| `getAvailableCurrencies` | function | `async getAvailableCurrencies(): Promise<string[]>` — Get list of available cryptocurrencies. | 96 |
| `getMinimumAmount` | function | `async getMinimumAmount(currencyFrom: string, currencyTo: string = "usd"): Promise<CryptoMinAmount>` — Get minimum payment amount for a crypto currency. | 107 |
| `getEstimatedPrice` | function | `async getEstimatedPrice(amount: number, currencyFrom: string, currencyTo: string): Promise<{ estimated_amount: number; currency_from…` — Get estimated price in crypto for a given fiat amount. | 121 |
| `createPayment` | function | `async createPayment(options: CreateCryptoPaymentOptions): Promise<CryptoPaymentResponse>` — Create a crypto payment. | 137 |
| `createInvoice` | function | `async createInvoice(options: CreateCryptoPaymentOptions): Promise<{ id: string; invoice_url: string }>` — Create an invoice on NOWPayments (hosted payment page). | 176 |
| `getPaymentStatus` | function | `async getPaymentStatus(paymentId: number \| string): Promise<CryptoPaymentStatus>` — Get payment status by payment ID. | 211 |
| `verifyIpnSignature` | function | `verifyIpnSignature(body: Record<string, any>, receivedSignature: string): boolean` — Verify IPN (webhook) signature from NOWPayments. | 241 |
| `isConfigured` | function | `isConfigured(): boolean` — Check if NOWPayments is configured (API key exists). | 270 |

## Interfaces

- **Other fetch/api calls (target not statically resolvable):**
  - `GET ${getApiBase()}/status` (L85)
  - `GET ${getApiBase()}/currencies` (L97)
  - `GET ${getApiBase()}/min-amount?currency_from=${currencyFrom}&currency_to=${currencyTo}` (L111)
  - `GET ${getApiBase()}/estimate?amount=${amount}&currency_from=${currencyFrom}&currency_to=${currencyTo}` (L126)
  - `POST ${getApiBase()}/payment` (L152)
  - `POST ${getApiBase()}/invoice` (L189)
  - `GET ${getApiBase()}/payment/${paymentId}` (L214)
- **Environment variables (`process.env`):** `NOWPAYMENTS_SANDBOX`, `NOWPAYMENTS_API_KEY`, `NOWPAYMENTS_IPN_SECRET`
- **External hosts mentioned in the code:** `api.nowpayments.io`, `my.garage.app`, `api-sandbox.nowpayments.io`

## Dependencies

- **Internal:** none
- **Packages:**
  - `crypto`

## Used by

- `server/routes/nowpaymentsWebhook.ts`
