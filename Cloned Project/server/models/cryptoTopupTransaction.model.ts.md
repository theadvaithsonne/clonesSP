# `server/models/cryptoTopupTransaction.model.ts`

> Every top-up credit onto a user's crypto-currency StoreWallet gets a row here.

**Kind:** Mongoose model · **Lines:** 109

<!-- docgen:auto -->

## Purpose
Every top-up credit onto a user's crypto-currency StoreWallet gets
a row here. Distinct from WalletTransaction (which holds general
wallet ledger entries) so the "top-up history" surface in the FE
can be queried without wading through refunds, transfers, coupon
credits, etc.

Write path: `creditUserWalletFromTopup` in the watcher/poller
stack — after a UserCryptoAddress-matched deposit is detected and
the user's StoreWallet balance is $inc'd, one of these rows is
created (idempotently via `metadata.dedupeKey`).

The dedupeKey is `sha256(txHash + address)` — same shape as
WalletTransaction crypto credits. Prevents a WS-reconciler race
from double-crediting the same on-chain tx.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Model `CryptoTopupTransaction`

- **Collection:** `cryptotopuptransactions` (default pluralised name)
- **Schema options:** `timestamps: true`

| Field | Type | Flags |
|---|---|---|
| `userId` | `Schema.Types.ObjectId` | required, index, ref "User" |
| `orgId` | `Schema.Types.ObjectId` | required, index, ref "Organization" |
| `walletId` | `Schema.Types.ObjectId` | required, index, ref "StoreWallet" |
| `currency` | `String` | required, enum ["BTC", "ETH", "USDT"] |
| `chain` | `String` | required, enum ["bitcoin", "ethereum", "polygon", "bsc", "… |
| `coin` | `String` | required, enum ["BTC", "ETH", "USDT"] |
| `address` | `String` | required, index |
| `amountAtomic` | `String` | required |
| `amount` | `Number` | required |
| `amountUsdAtDeposit` | `Number` | default 0 |
| `txHash` | `String` | required, index |
| `fromAddress` | `String` | default "" |
| `blockNumber` | `Number` | default 0 |
| `receivedAt` | `Date` | required, default () => new Date() |
| `status` | `String` | index, default "credited", enum ["credited", "failed"] |
| `failureReason` | `String` | default "" |
| `metadata` | `{ dedupeKey }` | nested |

### Indexes

- `{ "metadata.dedupeKey": 1 }, { unique: true, partialFilterExpression: { "metadata.dedupeKey": { $exists: true } }, }` (L86)
- `{ userId: 1, orgId: 1, receivedAt: -1 }` (L95)
- `{ walletId: 1, receivedAt: -1 }` (L96)

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `ICryptoTopupTransaction` | type |  | 98 |
| `CryptoTopupTransaction` | const | `= (mongoose.models .CryptoTopupTransaction as Model<ICryptoTopupTransaction>) \|\| mongoose…` | 102 |

## Interfaces

None detected: no endpoints, events, data access or environment reads were found.

## Dependencies

- **Internal:** none
- **Packages:**
  - `mongoose` — `Schema`, `InferSchemaType`, `Model`

## Used by

- `server/routes/wallet.ts`
