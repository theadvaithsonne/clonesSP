# `server/models/affiliateWallet.model.ts`

> Mongoose model `AffiliateWallet`: each user's single affiliate/commission wallet holding a USD balance and lifetime totals.

**Kind:** Mongoose model · **Lines:** 60

## Purpose
This is the main earnings wallet of the affiliate/MLM system. Commission engines credit it, forfeiture logic debits it, and withdrawals draw from it. Many services and maintenance scripts read or write it (23 importers), so its fields are effectively a shared contract.

## How it works
- One wallet per user: `userId` is required and unique (ref `User`).
- `balance` - current spendable amount (default 0, `min: 0`, so a write that would go negative fails validation on `save`).
- `currency` - default `"USD"`.
- `isActive` - default `true`.
- `totalEarnings` - lifetime **gross** commission credited.
- `totalWithdrawn` - lifetime withdrawn.
- `totalForfeited` - lifetime commission credited then taken back (no licence, no NetworkChain subscription, or cascaded to an upline - see `services/commissionForfeiture.ts`). Net kept = `totalEarnings - totalForfeited`. Older wallets lack the field, so readers should use `(w.totalForfeited || 0)`.
- `lastTransactionAt` - timestamp of the last movement.
- Timestamps on; collection `affiliatewallets`.

Amounts are floating-point USD main units (as noted in `auctionWallet.model.ts`, which says it matches AffiliateWallet).

## Exports
- `AffiliateWallet` - Mongoose model (untyped `model(...)`; no TS interface exported).

## Interfaces
- **Database:** `AffiliateWallet` (collection `affiliatewallets`).

## Dependencies
- **Packages:** `mongoose`.

## Used by
`server/controllers/garageAdmin.controller.ts`; services `affiliate.ts`, `affiliateAnalytics.ts`, `campaignWallet.ts`, `cashbackCode.ts`, `commission.ts`, `commissionForfeiture.ts`, `contentRewardsWallet.ts`, `officeAddonSubscription.ts`, `officeSubscription.ts`, `unilevelPlusCommission.ts`, `uplineCommissionMove.ts`, `wallet.ts`, `withdrawal.ts`; and maintenance scripts under `server/scripts/` (`delete-yopmail-users.ts`, `migrate-sweep-locked-earnings.ts`, `migrate-wallets.ts`, `move-unilevel-commission.ts`, `reset-wallets.ts`, `retro-migrate-cascade-to-up.ts`, `retro-pool-delta.ts`, `retro-up-single-to-six-units.ts`, `seed-affiliate-balance.ts`) - 23 importers in total.

## Notes
- `min: 0` constraints are enforced by Mongoose validation on `save()`/`create()`, but **not** by atomic `$inc` updates unless `runValidators` is used, so services relying on `$inc` must guard against negatives themselves.
- The scripts listed above run against `MONGODB_URI`, which in this project is the production database.
