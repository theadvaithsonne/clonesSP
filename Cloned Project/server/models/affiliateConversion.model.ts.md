# `server/models/affiliateConversion.model.ts`

> Mongoose model `AffiliateConversion`: one row per purchase a storefront reports against an affiliate ref, for analytics only.

**Kind:** Mongoose model · **Lines:** 74

## Purpose
Tracks affiliate-attributed purchases separately from clicks (`AffiliateClick`) so conversions never inflate click counts and purchases without a tracked click are still captured. The header is explicit that this is **analytics only** - commission payout stays on the `referredBy` / CombPlan pipeline.

## How it works
- **Idempotency:** unique sparse index `conversion_order_unique` on `orderId` (the storefront's order id), so retries and webhook replays don't double-count. Reports without an `orderId` are not deduplicated.
- `sessionId` ties a conversion back to the originating click when known.
- Fields: `affiliateId` (required, indexed), `affiliateUserId`, `orgId`, `itemType` (required; `channel`, `product`, `office`, `course`, `workshop`, `service`, `call`), `itemId`, `itemName`, `sessionId`, `visitorId`, `orderId`, `amount` (default 0), `currency` (default `"USD"`), timestamps.
- Other indexes: `affiliate_conversions_idx` `{ affiliateUserId, createdAt -1 }` (conversions today / listing) and `affiliate_conversion_item_idx` `{ affiliateUserId, itemType, itemId, createdAt -1 }` (per-item breakdown).

## Exports
- `AffiliateConversion` - Mongoose model.
- `interface IAffiliateConversion` - document shape.

## Interfaces
- **Database:** `AffiliateConversion` (collection `affiliateconversions`).

## Dependencies
- **Packages:** `mongoose`.

## Used by
- `server/routes/affiliate.ts` (mounted at `/affiliate`, browser `/backend/affiliate`) - `POST /affiliate/conversion` writes rows; stats endpoints read them.
- `server/routes/feed.ts` (mounted at `/feed`).
