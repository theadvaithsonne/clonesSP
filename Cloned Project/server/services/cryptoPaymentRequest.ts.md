# `server/services/cryptoPaymentRequest.ts`

> Payment-request service for the in-house crypto flow.

**Kind:** backend service · **Lines:** 595

<!-- docgen:auto -->

## Purpose
Payment-request service for the in-house crypto flow. Three surfaces:
  createRequest — called when a customer picks Pay-with-crypto on an
    invoice. Generates a unique amount-tail, persists the request,
    returns everything the FE needs to render the payment panel.
  findPendingByAmount — poller hot path. Given a chain + atomic
    amount observed on-chain, returns the matching pending request
    (or null when the amount doesn't correlate to any outstanding
    request; also flips both to `needs_review` on collision).
  markMatched — flips a request to matched, marks the invoice paid,
    runs existing fulfillInvoice (which credits the seller in USD).

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `CreateCryptoRequestResult` | interface |  | 140 |
| `createRequest` | function | `async createRequest(invoiceId: string, chain: CryptoChain, coin: CryptoCoin, amountInUsdCents: number): Promise<CreateCryptoRequestResult>` — Create (or reuse) a pending payment request for an invoice. | 170 |
| `findPendingByAddress` | function | `async findPendingByAddress(chain: CryptoChain, toAddress: string): Promise<ICryptoPaymentRequest \| null>` — HD settlement fast-path. | 458 |
| `findPendingByAmount` | function | `async findPendingByAmount(chain: CryptoChain, atomicAmount: string): Promise<ICryptoPaymentRequest \| null>` — Poller hot path. Given an incoming transaction on `chain` with `atomicAmount`, look up the matching pending request. | 483 |
| `markMatched` | function | `async markMatched(params: { requestId: string; txHash: string; fromAddress?: …): Promise<void>` — Mark a pending request as matched, then run the standard invoice fulfillment (which credits the seller's store wallet in USD and distributes commissions — same code path as any other payment). | 516 |
| `expireStaleRequests` | function | `async expireStaleRequests(): Promise<number>` — Sweep expired pending requests to `expired`. | 588 |

## Interfaces

- **Database (Mongoose models used):**
  - `Invoice` (server/models/invoice.model.ts) — reads: `findById`
  - `CryptoPaymentRequest` (server/models/cryptoPaymentRequest.model.ts) — reads: `findOne`, `find`; **writes:** `updateOne`, `create`, `updateMany`, `findOneAndUpdate`

## Dependencies

- **Internal:**
  - `server/models/cryptoPaymentRequest.model.ts` — `CryptoPaymentRequest`, `ICryptoPaymentRequest`, `CryptoChain`, `CryptoCoin`
  - `server/models/invoice.model.ts` — `Invoice`
  - `server/services/invoice.ts` — `fulfillInvoice`
  - `server/config/cryptoWallets.ts` — `getChainConfig`
  - `server/services/cryptoAddressAllocator.ts` — `allocateAddress`, `isHdChainEnabled`
  - `server/config/env.ts` — `env`
- **Packages:**
  - `crypto`
  - `mongoose` — `Types`

## Used by

- `server/app.ts`
- `server/scripts/diagnose-crypto-invoice.ts`
- `server/services/invoice.ts`
