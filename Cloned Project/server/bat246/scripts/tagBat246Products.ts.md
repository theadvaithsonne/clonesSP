# `server/bat246/scripts/tagBat246Products.ts`

> One-off script that adds the `bat246_entry` tag to every product in the BAT246 organisation (or to a given list of product ids).

**Kind:** backend one-off script (writes to the production DB) · **Lines:** 87

## Purpose
The BAT246 game treats a product as a board entry when its `tags` include `bat246_entry`. Products created in the BAT246 office through the normal store UI do not carry that tag, so this script tags them in bulk. It targets products by `organizationId` rather than by name, which the header calls the most reliable selector.

## How it works
1. `dotenv.config()`, connect to `MONGODB_URI` (fallback `mongodb://localhost:27017/garage`). **Production database in this project.**
2. Chooses the target set:
   - if `BAT246_PRODUCT_IDS` is set (comma-separated ObjectIds), only those products;
   - otherwise all products whose `organizationId` equals the hard-coded `BAT246_ORG_ID` (L19).
3. Uses the raw driver on the `products` collection: lists the matched products with their current tags and whether they are already tagged; exits cleanly if none match.
4. `updateMany({ _id: { $in: ids } }, { $addToSet: { tags: "bat246_entry" } })` - `$addToSet` never duplicates the tag, so re-running is safe.
5. Prints matched/modified counts and the final tag state of each product, then disconnects. Errors exit with code 1.

## Exports
None.

## Interfaces
- **Database:** collection `products` - read and update (raw driver; no Mongoose validation or hooks).
- **Environment variables:** `MONGODB_URI` - connection string (production); `BAT246_PRODUCT_IDS` - optional comma-separated product ids to restrict the update.

## Dependencies
- **Packages:** `mongoose` (connection and raw collection access), `dotenv`.

## Used by
Not imported anywhere. Run by hand, e.g. `npx tsx server/bat246/scripts/tagBat246Products.ts` or `BAT246_PRODUCT_IDS=id1,id2 npx tsx server/bat246/scripts/tagBat246Products.ts`.

## Notes
- Every product in the org becomes a board entry for the game's purposes, including any non-entry merchandise sold in the same store. Use `BAT246_PRODUCT_IDS` when only some products should be tagged.
- With `BAT246_PRODUCT_IDS`, the org filter is not applied, so ids from any organisation are tagged.
- An invalid id in `BAT246_PRODUCT_IDS` makes `new mongoose.Types.ObjectId(id)` throw and the run aborts before any update.
