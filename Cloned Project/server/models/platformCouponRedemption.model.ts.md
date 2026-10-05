# `server/models/platformCouponRedemption.model.ts`

> Mongoose model recording each use of a `PlatformCoupon` by a user, including how many subscription billing cycles the discount still covers.

**Kind:** Mongoose model · **Lines:** 90

## Purpose
A coupon (see `platformCoupon.model.ts`) can discount a one-time purchase once, or a subscription for several billing cycles. This collection is the per-use record: which user redeemed which coupon against which invoice, a snapshot of the discount terms at that moment, and how many cycles have been applied so far. Renewal logic consults it to keep discounting until the coupon's cycles are used up.

## How it works
- **Fields:**
  - `couponId` (ref `PlatformCoupon`, required, indexed) and `couponCode` (snapshot).
  - `userId` (ref `User`, required).
  - `productType` - same list as the coupon model **minus `ecommerce`**.
  - `parentInvoiceId` (ref `Invoice`, indexed) - for subscription products, the parent subscription invoice the discount follows across renewals.
  - `invoiceId` (ref `Invoice`) - for one-time products (the inline comment names `unilevel_plus`).
  - `cycleCount` (default 1, min 1) - snapshot of how many cycles the discount covers (1 for one-time).
  - `cyclesApplied` (default 0) - cycles discounted so far.
  - Discount snapshot: `discountType` (`fixed` / `percent`), `discountValue`, optional `maxDiscountAmount`, `currency` (`USD` / `INR`).
  - `status` - `active`, `exhausted` (all cycles used) or `cancelled`; default `active`, indexed.
  - `timestamps: true`.
- **Indexes:** unique sparse `{ invoiceId: 1 }` (at most one redemption per one-time invoice; rows without `invoiceId` are not indexed) and `{ userId: 1, couponId: 1 }` for per-user usage limits (`maxUsagePerUser`).
- Snapshotting the terms means later edits to the coupon do not change discounts already granted.

## Exports
- `PlatformCouponRedemptionStatus` - `"active" | "exhausted" | "cancelled"`.
- `IPlatformCouponRedemption` - document interface.
- `PlatformCouponRedemption` - the Mongoose model.

## Interfaces
- **Database:** `PlatformCouponRedemption` (collection `platformcouponredemptions`); references `PlatformCoupon`, `Invoice`, `User`.

## Dependencies
- **Internal:** `server/models/platformCoupon.model.ts` - type-only import of `PlatformCouponProductType` and `PlatformCouponDiscountType`.
- **Packages:** `mongoose`.

## Used by
- `server/services/platformCoupon.ts` - applies coupons and advances `cyclesApplied`.
- `server/services/couponAssignment.ts`, `server/services/invoice.ts`, `server/services/thirdPartyTerms.ts`.
- `server/scripts/grant-networkchain-coupon-hiren.ts` - hand-run script against `MONGODB_URI` (production database).

## Notes
- `ecommerce` is accepted by `PlatformCoupon.productType` but not by this schema's enum, so saving a redemption for an e-commerce coupon would fail validation. Check the service before relying on e-commerce coupon redemptions being recorded here.
