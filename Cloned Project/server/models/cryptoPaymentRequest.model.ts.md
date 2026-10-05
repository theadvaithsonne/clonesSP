# `server/models/cryptoPaymentRequest.model.ts`

> In-house crypto payment request.

**Kind:** Mongoose model · **Lines:** 189

<!-- docgen:auto -->

## Purpose
In-house crypto payment request. Created when a customer picks
"Pay with crypto" on an invoice; the amount-tail is unique per
invoice so our chain poller can correlate an incoming on-chain
transaction back to the right invoice.

Statuses:
  pending — waiting for the customer to send. Expires after 15 min.
  matched — poller matched an incoming tx to this request; the
            invoice has been marked paid and fulfillInvoice ran.
  expired — expiresAt passed with no match. Payments arriving after
            expiry land in the admin "unmatched" queue (no auto-match).
  needs_review — two `pending` requests collided on the same expected
            amount (should be ~1x/year at our scale). Admin picks apart
            by tx hash / timestamp.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Model `CryptoPaymentRequest`

- **Collection:** `cryptopaymentrequests` (default pluralised name)
- **Schema options:** `timestamps: true`

| Field | Type | Flags |
|---|---|---|
| `invoiceId` | `Schema.Types.ObjectId` | required, index, ref "Invoice" |
| `chain` | `String` | required, enum ["tron", "polygon", "bsc", "ethereum", "bit… |
| `coin` | `String` | required, enum ["USDT", "USDC", "ETH", "BTC", "POL"] |
| `platformAddress` | `String` | required |
| `expectedAmountAtomic` | `String` | required |
| `expectedAmountDisplay` | `String` | required |
| `expiresAt` | `Date` | required |
| `status` | `String` | required, default "pending", enum ["pending", "matched", "expired", "needs_re… |
| `matchedTxHash` | `String` | — |
| `matchedAt` | `Date` | — |
| `matchedFromAddress` | `String` | — |
| `derivationIndex` | `Number` | — |
| `isHdDerived` | `Boolean` | — |
| `addressExpiresAt` | `Date` | — |
| `swept` | `Boolean` | — |
| `sweptAt` | `Date` | — |
| `sweepTxHash` | `String` | — |
| `fundsReceivedAt` | `Date` | — |
| `fundsReceivedTxHash` | `String` | — |
| `fundsReceivedAtomic` | `Number` | — |
| `nativeRecoveryTxHash` | `String` | — |
| `nativeRecoveredAmount` | `Number` | — |
| `nativeRecoveryFailedReason` | `String` | — |
| `nativeRecoveryAttemptedAt` | `Date` | — |
| `usdPerCoinAtMint` | `Number` | — |

### Indexes

- `{ chain: 1, expectedAmountAtomic: 1, status: 1, }` (L152)
- `{ expiresAt: 1, status: 1 }` (L159)
- `{ platformAddress: 1 }, { partialFilterExpression: { status: { $in: ["pending", "needs_review"] }, }, }` (L165)
- `{ addressExpiresAt: 1, status: 1 }` (L176)
- `{ status: 1, swept: 1, chain: 1 }` (L179)
- `{ fundsReceivedAt: 1, swept: 1, chain: 1 }` (L183)

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `CryptoChain` | type |  | 17 |
| `CryptoCoin` | type |  | 22 |
| `CryptoPaymentRequestStatus` | type |  | 23 |
| `ICryptoPaymentRequest` | interface |  | 29 |
| `CryptoPaymentRequest` | model | `model<ICryptoPaymentRequest>( "CryptoPaymentRequest", CryptoPaymentRequestSchema )` | 185 |

## Interfaces

None detected: no endpoints, events, data access or environment reads were found.

## Dependencies

- **Internal:** none
- **Packages:**
  - `mongoose` — `Schema`, `model`, `Types`

## Used by

- `server/config/cryptoWallets.ts`
- `server/scripts/diagnose-crypto-invoice.ts`
- `server/services/cryptoPaymentRequest.ts`
