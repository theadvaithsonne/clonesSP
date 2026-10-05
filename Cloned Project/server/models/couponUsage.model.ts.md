# `server/models/couponUsage.model.ts`

> Mongoose model recording each redemption of a legacy `Coupon` against a one-time payment or subscription, with amounts and status.

**Kind:** Mongoose model · **Lines:** 123

## Purpose
Every time a buyer applies a legacy coupon at checkout, a `CouponUsage` row is written. It is the basis for per-user usage limits, coupon analytics, and keeping `Coupon.currentUsageCount` honest: usage is recorded as `pending` when the order or subscription is created and only counts towards the coupon's total once the payment succeeds.

## How it works
- **Links:** `couponId` (ref `Coupon`), `userId` (ref `User`), optional `orgId`.
- **Transaction:** `transactionType` `one_time` or `subscription`; `transactionId` (the Razorpay order id or subscription id); `itemType` (free string) and `itemId`.
- **Amounts (paise):** `originalAmount`, `discountAmount`, `finalAmount`.
- **Subscriptions:** optional `subscriptionId` (ref `Subscription`) and `paymentNumber` (billing cycle, min 1).
- **Status:** `pending` (default), `applied`, `refunded`, `failed`; `appliedAt` when applied.
- `timestamps: true`.
- **Indexes:** `{couponId, userId}` (per-user limit checks), `{userId, itemType, itemId}`, `{transactionId}`, `{status}`, `{createdAt:-1}`.

Lifecycle in `server/services/coupon.ts`: `recordCouponUsage` creates a `pending` row; `markUsageApplied` sets `applied` + `appliedAt` and increments `Coupon.currentUsageCount`; `markUsageFailed` sets `failed`. `validateCoupon` counts `pending` and `applied` rows for `maxUsagePerUser`, so a pending (unpaid) attempt temporarily uses up a slot. `server/routes/officeCheckout.ts` marks pending usages for a Razorpay subscription as `failed` when that subscription is replaced or cancelled, freeing the coupon for reuse.

## Exports
- `CouponUsage` - Mongoose model (`"CouponUsage"`, collection `couponusages`).
- `ICouponUsage` - document interface.
- `CouponUsageTransactionType` - `"one_time" | "subscription"`.
- `CouponUsageStatus` - `"pending" | "applied" | "refunded" | "failed"`.

## Interfaces
- **Database:** `CouponUsage` (collection `couponusages`) - read/write.
- **External services:** stores Razorpay order/subscription ids in `transactionId`.

## Dependencies
- **Packages:** `mongoose`.

## Used by
`server/services/coupon.ts` and `server/routes/officeCheckout.ts` (mounted at `/checkout/office`, browser `/backend/checkout/office`).

## Notes
- The `refunded` status is defined but neither of the importing files sets it.
- Abandoned checkouts leave `pending` rows that keep counting against the per-user limit until something marks them failed.
