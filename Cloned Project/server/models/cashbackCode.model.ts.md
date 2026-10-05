# `server/models/cashbackCode.model.ts`

> Mongoose model for an affiliate-issued cashback code: a rebate code bound to one product that a creator's direct downline can enter at checkout to get part of the creator's commission back.

**Kind:** Mongoose model · **Lines:** 159

## Purpose
Affiliates earn a level-1 commission when their direct downline buys an item. A cashback code lets the affiliate (the "creator") give part of that commission back to the buyer. The code is typed into the same checkout box as a `PlatformCoupon`. When a qualifying buyer pays in full, invoice fulfilment runs an `executeCashback` step after commissions are distributed: it confirms the cart contains the bound product, caps the rate at the actual level-1 commission rate for that line, and moves money from the creator's `AffiliateWallet` to the buyer's `StoreWallet` for the seller org. Each attempt is logged in `CashbackDistribution`.

## How it works
Fields (`ICashbackCode`, with `timestamps`):
- `code` - required, **unique**, upper-cased, trimmed, 3-20 characters, `^[A-Z0-9_-]+$`.
- `name` (required, max 100), `description` (max 500).
- `creatorId` (`User`) - the affiliate who owns the code, indexed.
- `status` - `active` (default), `inactive`, `expired`.
- **Bound product:** `productType` (one of `CASHBACK_PRODUCT_TYPES`), `itemId` (the item's id, no `ref` because the target collection varies), `orgId` (seller org, derived when the code is created and used to credit the right `StoreWallet`).
- `ratePct` - configured cashback as a percent of the sale, 0.01-100. At execution the applied rate is `min(ratePct, level1RatePct)` so the creator never goes negative on a line.
- `allowedBuyerIds` - optional whitelist of `User` ids. Empty means any direct downline may use it; when set, each entry is validated at creation to be one of the creator's direct downline. The direct-downline gate always applies.
- **Lifecycle limits:** `cycleCount` (default 1; how many subscription cycles per buyer-subscription get cashback), `validFrom` (default now), `validUntil`, `maxUsageCount`, `maxUsagePerUser`, `currentUsageCount` (default 0), `minOrderAmountCents` (floor on invoice subtotal in USD cents).

`CASHBACK_PRODUCT_TYPES` is `product`, `channel`, `course`, `workshop`, `service`, `call`, `ecommerce`. It mirrors the founder-coupon product types minus platform-level ones (`office_plan`, `unilevel_plus`, `third_party_subscription`), which are distributed through `UnilevelPlusDistribution` rather than the normal commission flow. The invoice line type `ecommerce_item` maps to the key `ecommerce` (`mapItemTypeToCashbackType` in the cashback service).

Indexes: `{ creatorId, status, createdAt: -1 }` (creator dashboard), `{ productType, itemId, status }` (lookup by product), plus single-field indexes.

Collection: Mongoose default, `cashbackcodes`.

## Exports
- `CashbackCode` - the model.
- `CASHBACK_PRODUCT_TYPES` - product-type keys (`as const`).
- `type CashbackProductType` - union of those keys.
- `type CashbackCodeStatus` - `"active" | "inactive" | "expired"`.
- `interface ICashbackCode` - document type.

## Interfaces
- **Database:** `CashbackCode` (collection `cashbackcodes`) - CRUD through `server/routes/cashbackCodes.ts` (mounted at `/cashback-codes`, browser `/backend/cashback-codes/...`, which also re-exports `CASHBACK_PRODUCT_TYPES` and validates with a zod enum of it); validated and executed in `server/services/cashbackCode.ts`; consulted during invoicing in `server/services/invoice.ts`.

## Dependencies
- **Packages:** `mongoose` - schema, model, types.

## Used by
`server/models/cashbackDistribution.model.ts` (reuses the product-type list), `server/routes/cashbackCodes.ts`, `server/services/cashbackCode.ts`, `server/services/invoice.ts`.

## Notes
- The header points to "the plan / FOUNDER_COUPONS_API doc" for the full lifecycle.
- Changing `CASHBACK_PRODUCT_TYPES` also changes the enum on `CashbackDistribution.productType` and the API validation.
