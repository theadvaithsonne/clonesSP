# `server/bat246/scripts/seedBat246Product.ts`

> One-off seed that creates the $1 "Bat246 Board Entry" product (tag `bat246_entry`) if none exists and points every BAT246 board's invite links at it.

**Kind:** backend one-off script (writes to the production DB) · **Lines:** 74

## Purpose
BAT246 entries are sold as an ordinary digital `Product` in an organisation's store; the game recognises the product by the tag `bat246_entry`, and each board's `inviteProductId` says which product its invite links sell. This script creates that product on its own, without touching boards' slots or players (unlike `seedBat246.ts`, which wipes the game first). Several other scripts look up the BAT246 org through this product.

## How it works
1. `dotenv.config()`, connect to `MONGODB_URI` (fallback `mongodb://localhost:27017/garage`). **Production database in this project.**
2. If any `Product` with `tags: "bat246_entry"` already exists, prints its id, name, status and org, then disconnects without writing.
3. Otherwise picks:
   - `admin`: the first `User` whose `role` is `admin`, `founder` or `superAdmin`;
   - the org: `process.env.BAT246_ORG_ID`, else `admin.organizationId`, else the first `Organization` found.
   If either is missing it logs an error and exits with code 1.
4. Creates the product: `name: "Bat246 Board Entry"`, `slug: "bat246-board-entry"`, description "Purchase a position on a new Bat246 board. You will be placed at Home Plate.", `sku: "BAT246-ENTRY-001"`, `price: 1`, `currency: "USD"`, `isDigital: true`, `requiresShipping: false`, `deliveryMethod: "digital"`, `status: "active"`, `tags: ["bat246_entry"]`, `trackQuantity: false`, `createdBy: admin._id`.
5. Dynamically imports `Bat246Board` and runs `updateMany({}, { $set: { inviteProductId: <new product id> } })` on **every** board.
6. Logs ids and disconnects; errors exit with code 1.

## Exports
None.

## Interfaces
- **Database:**
  - `Product` (collection `products`) - read; create one.
  - `User` (collection `users`), `Organization` (collection `organizations`) - read.
  - `Bat246Board` (collection `bat246boards`) - update all boards' `inviteProductId`.
- **Environment variables:** `MONGODB_URI` - connection string (production); `BAT246_ORG_ID` - optional target org.

## Dependencies
- **Internal:** `server/models/product.model.ts`, `server/models/organization.model.ts`, `server/models/user.model.ts`; `server/bat246/models/bat246Board.model.ts` (imported dynamically).
- **Packages:** `mongoose`, `dotenv`.

## Used by
Not imported anywhere. Run by hand, e.g. `npx tsx server/bat246/scripts/seedBat246Product.ts`. `addPlayersToOrg.ts` and `addTestUsers10to19.ts` tell you to run it first.

## Notes
- The header says it is "safe to run at any time", but when it does create a product it overwrites `inviteProductId` on all boards, including boards that already pointed at a different product.
- The `User` schema has no `organizationId` field, so without `BAT246_ORG_ID` the product usually lands in the first organisation `Organization.findOne()` returns, which may not be the BAT246 office. `seedBat246ProductForOrg.ts` is the targeted alternative.
- The existence check is global (any org), so it will not create a second product for another org.
