# `server/models/walletTransaction.model.ts`

> Mongoose model `WalletTransaction` (collection `wallettransactions`) with 16 top-level fields.

**Kind:** Mongoose model · **Lines:** 172

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Model `WalletTransaction`

- **Collection:** `wallettransactions` (default pluralised name)
- **Schema options:** `timestamps: true`

| Field | Type | Flags |
|---|---|---|
| `storeWalletId` | `Schema.Types.ObjectId` | index, ref "StoreWallet" |
| `affiliateWalletId` | `Schema.Types.ObjectId` | index, ref "AffiliateWallet" |
| `walletType` | `String` | required, index, enum ["store", "affiliate"] |
| `userId` | `Schema.Types.ObjectId` | required, index, ref "User" |
| `orgId` | `Schema.Types.ObjectId` | index, ref "Organization" |
| `type` | `String` | required, index, enum ["credit", "debit", "transfer", "commission… |
| `amount` | `Number` | required |
| `currency` | `String` | default "USD" |
| `balanceBefore` | `Number` | required |
| `balanceAfter` | `Number` | required |
| `description` | `String` | required, trim |
| `note` | `String` | trim |
| `relatedUserId` | `Schema.Types.ObjectId` | ref "User" |
| `relatedTransactionId` | `Schema.Types.ObjectId` | ref "WalletTransaction" |
| `metadata` | `Schema.Types.Mixed` | — |
| `status` | `String` | index, default "completed", enum ["completed", "pending", "failed", "reverse… |

### Indexes

- `{ userId: 1, walletType: 1, createdAt: -1 }` (L108)
- `{ storeWalletId: 1, createdAt: -1 }` (L109)
- `{ affiliateWalletId: 1, createdAt: -1 }` (L110)
- `{ orgId: 1, type: 1, createdAt: -1 }` (L111)
- `{ relatedUserId: 1, createdAt: -1 }` (L112)
- `{ "metadata.dedupeKey": 1 }, { unique: true, partialFilterExpression: { "metadata.dedupeKey": { $exists: true } }, }` (L119)
- `{ "metadata.transferGroupId": 1 }, { partialFilterExpression: { "metadata.transferGroupId": { $exists: true } }, }` (L133)

**Schema hooks / virtuals:** `pre("validate")`

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `WalletTransaction` | model | `model( "WalletTransaction", WalletTransactionSchema )` | 168 |

## Interfaces

None detected: no endpoints, events, data access or environment reads were found.

## Dependencies

- **Internal:** none
- **Packages:**
  - `mongoose` — `Schema`, `model`

## Used by

- `server/bat246/services/bat246LostMoneyAutoPay.service.ts`
- `server/bat246/services/bat246Wallet.util.ts`
- `server/routes/franchiseApi.ts`
- `server/routes/garageAdminStoreWallets.ts`
- `server/routes/hifiInvoice.ts`
- `server/routes/invoice.ts`
- `server/routes/wallet.ts`
- `server/routes/walletHq.ts`
- `server/scripts/_convert-shorupan-hq-to-usd.ts`
- `server/scripts/audit-cryptobrand-bootstrap.ts`
- `server/scripts/audit-whitelabel-state.ts`
- `server/scripts/delete-yopmail-users.ts`
- `server/scripts/diagnose-shorupan-btc-wallet.ts`
- `server/scripts/diagnose-whitelabel-commission.ts`
- `server/scripts/diagnoseAuctionSettlement.ts`
- `server/scripts/find-redbarons.ts`
- `server/scripts/find-stuck-commissions.ts`
- `server/scripts/inspect-invoice.ts`
- `server/scripts/inspect-shorupan-gapp-wallets.ts`
- `server/scripts/inspect-whitelabel-txs.ts`
- `server/scripts/latest-whitelabel-purchase.ts`
- `server/scripts/migrate-content-rewards-to-org-rewards.ts`
- `server/scripts/migrate-sweep-locked-earnings.ts`
- `server/scripts/move-unilevel-commission.ts`
- `server/scripts/reconcile-franchise-floor-credits.ts`
- _…and 44 more_
