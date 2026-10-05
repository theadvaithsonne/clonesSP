# `server/models/platformCoupon.model.ts`

> Mongoose model for discount coupons created by garage admins (platform-wide) or founders (scoped to their organization), with the rules that decide whether a coupon applies across subscription billing cycles.

**Kind:** Mongoose model · **Lines:** 236

## Purpose
Coupons discount purchases across Garage's catalogue: office plans, Unilevel Plus licences, third-party subscriptions, channels, courses, workshops (webinars), products, services, calls, e-commerce orders and the franchise programme. A coupon is either `platform` scope (created by a garage admin, valid everywhere) or `organization` scope (created by a founder for their own office). Each actual use is tracked in `platformCouponRedemption.model.ts`.

## How it works

### Product types and billing categories (L3-L66)
`PlatformCouponProductType` lists the twelve purchasable types, including `franchise_program` (the $650/yr founder franchise opt-in; admin-only, discounts the enrolment invoice) and `franchise_territory` (admin-only; discounts **only** the $650 platform floor of a territory sale, never the founder/reseller markup).

Types fall into three billing categories, which govern `cycleCount` (how many billing cycles a discount applies to):
- **Always subscription** - `SUBSCRIPTION_PRODUCT_TYPES`: `office_plan`, `third_party_subscription`, `franchise_program`, `franchise_territory`. `cycleCount` is required.
- **Always one-time** - `ALWAYS_ONE_TIME_PRODUCT_TYPES`: `service`, `call`, `ecommerce`. Any `cycleCount` is stripped.
- **Mixed (per item)** - everything else (`channel`, `course`, `workshop`, `product`, and `unilevel_plus` by omission). The caller's `cycleCount` is honoured as-is, because the route layer already checked whether the specific item recurs.

The long comment records why `channel` and `workshop` were removed from the subscription list: they have per-item `isSubscription` flags, and the old blanket rule rejected valid one-time webinar coupons (founder report "Unable to create coupon for webinars"). `product` was likewise moved out of the one-time list because recurring digital products use `cycleCount`.

### Schema fields (L74-L191)
- `code` - unique, uppercased, trimmed, 3-20 characters, `/^[A-Z0-9_-]+$/`.
- `name` (required, max 100), `description` (max 500), `media` (optional banner image URL, max 2048; the caller hosts the image).
- `productType` (enum, indexed).
- `discountType` - `fixed` or `percent`; `discountValue` (min 1) is in the smallest unit of `currency` when fixed, or 1-100 when percent.
- `currency` - `USD` or `INR` (default `USD`): the denomination of `discountValue`, `maxDiscountAmount` and `minOrderAmount`.
- `maxDiscountAmount` - caps a percent discount.
- `cycleCount` (min 1).
- `status` - `active` / `inactive` / `expired` (default `active`, indexed).
- `validFrom` (default now), `validUntil`.
- `maxUsageCount`, `maxUsagePerUser`, `currentUsageCount` (default 0), `minOrderAmount`.
- `createdBy` (ObjectId, no ref because it can be an admin or a user) and `createdByType` (`garage_admin` / `founder`).
- `scope` - `platform` / `organization` (default `platform`, indexed); `orgId` (ref `Organization`, indexed).
- `specificItemIds` - optional ObjectId list targeting particular items of the product type (e.g. one channel); `default: undefined` so "no restriction" is distinguishable from an empty list.

### Pre-validate rules (L193-L226)
1. Subscription type without `cycleCount >= 1` -> error `"cycleCount is required for subscription-type coupons"`.
2. Always-one-time type -> `cycleCount` cleared.
3. `percent` with `discountValue > 100` -> error `"percent discount must be 1-100"`.
4. `organization` scope without `orgId` -> error; `platform` scope with `orgId` -> `orgId` cleared.

### Indexes (L228-L230)
`{ productType, status }`, `{ status, validFrom, validUntil }`, `{ scope, orgId, status }`.

## Exports
- `PlatformCouponProductType`, `PlatformCouponDiscountType` (`"fixed" | "percent"`), `PlatformCouponStatus`, `PlatformCouponScope` - types.
- `SUBSCRIPTION_PRODUCT_TYPES` / `isSubscriptionProductType(t)` - always-recurring types and predicate.
- `ALWAYS_ONE_TIME_PRODUCT_TYPES` / `isAlwaysOneTimeProductType(t)` - always-one-time types and predicate.
- `IPlatformCoupon` - document interface.
- `PlatformCoupon` - the Mongoose model.

## Interfaces
- **Database:** `PlatformCoupon` (collection `platformcoupons`).

## Dependencies
- **Packages:** `mongoose`.

## Used by
- Models: `server/models/platformCouponRedemption.model.ts` (type imports).
- Routes: `server/routes/adminCouponRules.ts`, `founderCouponRules.ts`, `founderPlatformCoupons.ts` (founder coupon CRUD, with the per-item `isItemRecurring` check), `founderStoreCommissions.ts`, `rewards.ts`, `userRewards.ts`.
- Services: `server/services/platformCoupon.ts`, `couponAssignment.ts`, `couponRule.ts`, `cashbackCode.ts`, `storeCouponCommission.ts`.
- Scripts (hand-run with tsx against `MONGODB_URI`, the production database): `server/scripts/grant-networkchain-coupon-hiren.ts`, `server/scripts/seedBat246FreeCoupon.ts`.

## Notes
- The pre-validate hook only runs on `save()`/`validate()`; `updateOne`/`findOneAndUpdate` bypass it, so route code that updates coupons that way must enforce the same rules.
- `currentUsageCount` is a counter maintained by the service; it is not derived from redemption rows.
- The enum list is duplicated in `platformCouponRedemption.model.ts`, which lacks `ecommerce`.
