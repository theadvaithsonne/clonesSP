# `server/bat246/scripts/fix-bat246-product-description.ts`

> One-off script that overwrites one specific BAT246 product's `description` with "BAT 246 - $650".

**Kind:** backend one-off script (writes to the production DB) · **Lines:** 37

## Purpose
An earlier script (`rename-bat246-product-title.ts`, no longer present in this repo) renamed the product's `name` from an internal-style value to "BAT 246 - $650" but left `description` holding the old internal name, which showed on the checkout page under the price. This script fixes the description.

## How it works
- Requires `MONGODB_URI` (throws if unset; no localhost fallback). **This is the production database in this project.**
- Connects, then dynamically imports the `Product` model.
- Logs the product's `name` and `description` before the change, runs `Product.updateOne({ _id: PRODUCT_ID }, { $set: { description: "BAT 246 - $650" } })`, then logs them again.
- `PRODUCT_ID` is a hard-coded ObjectId (L14), so the script only ever touches that one product.
- Disconnects; errors exit with code 1.

## Exports
None.

## Interfaces
- **Database:** `Product` (collection `products`) - read and update one document.
- **Environment variables:** `MONGODB_URI` - connection string (production; required).

## Dependencies
- **Internal:** `server/models/product.model.ts` - imported dynamically after connecting.
- **Packages:** `mongoose`, `dotenv`.

## Used by
Not imported anywhere. Run by hand, e.g. `npx tsx server/bat246/scripts/fix-bat246-product-description.ts` (header shows the old `src/...` path).

## Notes
Idempotent: re-running sets the same value again. If the hard-coded product id does not exist, `updateOne` silently matches nothing and the "Before"/"After" logs print `null`.
