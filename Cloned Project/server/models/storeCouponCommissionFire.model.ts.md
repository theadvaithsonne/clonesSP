# `server/models/storeCouponCommissionFire.model.ts`

> Mongoose model for a small ledger of coupon-commission "fires", used only to enforce per-(recipient, buyer) caps on store coupon commission rules.

**Kind:** Mongoose model · **Lines:** 96

## Purpose
Store coupon commission rules (`StoreCouponCommission`) grant platform coupons to upline recipients when a buyer pays a store invoice. Rules can be perpetual or `capType: "per_pair_capped"`. For capped rules the system has to know how many times a given recipient has already earned from a given buyer under that rule. Coupon grants are merged into `CouponAssignment.availableUses` and lose per-fire detail, so this dedicated collection records one row per successful fire. The header comment compares it to the CombPlan cap check, which reuses `CommissionDistribution`; the coupon side has no ledger like that.

## How it works
- One document per successful cascade fire, keyed by rule, level, recipient, buyer and invoice, with the coupon granted and the quantity.
- **Only capped rules insert rows.** Perpetual rules never read the counter, so they skip the insert and the collection stays small and quick to count.
- Indexes:
  - `{ ruleId, recipientId, buyerId }` is the hot path for the cap query (`countDocuments`).
  - `{ ruleId, invoiceId, recipientId }` is **unique**. It is a race backstop: if the outer `invoice.metadata.storeCommissionsFiredAt` guard is bypassed (webhook double-fire, manual re-run), the counter cannot move twice for the same invoice. The caller treats E11000 as "already recorded".
  - `{ orgId, createdAt: -1 }` supports admin drill-down of recent fires per org.
  - `ruleId` also has a single-field index.
- `timestamps: true` adds `createdAt` / `updatedAt`.

### Fields
| Field | Type | Notes |
|---|---|---|
| `ruleId` | ObjectId -> `StoreCouponCommission` | required, indexed |
| `orgId` | ObjectId -> `Organization` | required |
| `level` | Number | required, min 1 (cascade level) |
| `recipientId` | ObjectId -> `User` | required, the person who received the coupon |
| `buyerId` | ObjectId -> `User` | required, the purchaser |
| `invoiceId` | ObjectId -> `Invoice` | required |
| `couponId` | ObjectId -> `PlatformCoupon` | required |
| `quantity` | Number | required, min 1 |

## Exports
- `StoreCouponCommissionFire` - Mongoose model `"StoreCouponCommissionFire"` (default collection `storecouponcommissionfires`).
- `IStoreCouponCommissionFire` - TypeScript interface for the document.

## Interfaces
- **Database:** `StoreCouponCommissionFire` (collection `storecouponcommissionfires`). Read with `countDocuments` and written with `create` by the commission service.

## Dependencies
- **Packages:** `mongoose` - schema and model.

## Used by
- `server/services/storeCouponCommission.ts`. Inside the per-level loop it calls `countDocuments({ ruleId, recipientId, buyerId })` and skips the level when the count reaches `rule.capCount`. After `assignCoupon` succeeds it inserts a fire row, but only when the rule is capped, and ignores duplicate-key errors.

## Notes
- The cap is counted per (rule, recipient, buyer). Other buyers and other levels are not affected.
- The unique index is the last line of defence for idempotency. Do not drop it, or webhook retries could use up a pair's cap twice.
