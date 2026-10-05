# `server/models/coupon.model.ts`

> Mongoose model for the legacy percentage-discount coupon system, covering global (Garage admin) and organisation-scoped (founder) coupon codes.

**Kind:** Mongoose model · **Lines:** 211

## Purpose
This is the original coupon model, which buyers redeem at checkout for channels, courses, workshops, products, office plans/add-ons and event tickets. Garage admins create `global` coupons that work everywhere; founders create `organization` coupons limited to their org. A newer `PlatformCoupon` system exists alongside it, and `CouponAssignment` rows say which system a reward belongs to (`couponSource: "legacy"` refers to this model).

## How it works
- **Code:** `code` - unique, forced uppercase, trimmed, 3-20 characters, only `A-Z 0-9 _ -`. Also `name` (max 100) and optional `description` (max 500).
- **Discount:** percentage only. `discountValue` is 1-100; optional `maxDiscountAmount` caps the discount in paise.
- **Scope:** `scope` is `global` (default) or `organization`. A `pre("validate")` hook rejects an `organization` coupon without `orgId` and strips `orgId` from a `global` coupon.
- **Creator:** `createdBy` with `refPath: "createdByType"`, where `createdByType` is `garage_admin` or `founder`.
- **Razorpay:** optional `razorpayOfferId` maps the coupon to a Razorpay offer for subscription checkouts.
- **Applicability:** `applicableTo` - non-empty array of `ApplicableItemType` (`channel`, `course`, `workshop`, `product`, `office_plan`, `office_addon`, `event_ticket`). For `event_ticket`, item ids refer to the `EventProgram`, not a ticket tier, so the discount applies to whichever tier the buyer picks. Optional `specificItemIds` restricts the coupon to particular items.
- **Validity:** `validFrom` (default now), optional `validUntil`, `status` `active` (default) / `inactive` / `expired`.
- **Limits:** optional `maxUsageCount` (total), `maxUsagePerUser`, `currentUsageCount` (counter), optional `minOrderAmount` (paise).
- **Virtual `isValid`:** true when status is `active`, the current time is within the validity window and the total usage cap is not reached. Virtuals are included in `toJSON`/`toObject`.
- `timestamps: true`.
- **Indexes:** unique `{code}`, `{scope, orgId}`, `{status, validFrom, validUntil}`, `{createdBy, createdByType}`.

**Lifecycle in the service** (`server/services/coupon.ts`): `validateCoupon` checks status, dates, scope/org, item type, specific items, minimum order, total cap, and per-user cap (counting `CouponUsage` rows that are `pending` or `applied`), then `calculateDiscount` rounds `amount x discountValue / 100`, applies the cap and never exceeds the amount. `recordCouponUsage` writes a pending `CouponUsage`; `markUsageApplied` flips it to `applied` and `$inc`s `currentUsageCount`.

## Exports
- `Coupon` - Mongoose model (`"Coupon"`, collection `coupons`).
- `ICoupon` - document interface.
- Types: `CouponScope` (`"global" | "organization"`), `CouponStatus` (`"active" | "inactive" | "expired"`), `CouponCreatorType` (`"garage_admin" | "founder"`), `ApplicableItemType`.

## Interfaces
- **Database:** `Coupon` (collection `coupons`) - read/write; ref `Organization`.

## Dependencies
- **Packages:** `mongoose`.

## Used by
`server/services/coupon.ts`, `server/services/couponAssignment.ts`, `server/routes/couponValidation.ts` and `server/routes/rewards.ts` (both mounted at `/checkout`, browser `/backend/checkout`), `server/routes/garageAdminCoupons.ts` (`/garage-admin/coupons`), `server/routes/founderCoupons.ts` (`/org`), `server/routes/internal-catalog.ts` (`/internal/catalog`), and the manual script `server/bat246/scripts/createAlanKFreeCoupon.ts`.

## Notes
- `refPath: "createdByType"` points at the values `garage_admin` / `founder`, which are not registered model names, so `populate("createdBy")` would fail.
- `code` is declared `unique: true` on the field and again with `couponSchema.index({code: 1}, {unique: true})`; Mongoose may log a duplicate-index warning.
- `currentUsageCount` is only incremented when a usage is marked applied, and `validateCoupon` reads it without a lock, so concurrent checkouts can slightly exceed `maxUsageCount`.
- The `status` value `expired` is not set automatically by this model; `isValid` and `validateCoupon` check `validUntil` directly.
