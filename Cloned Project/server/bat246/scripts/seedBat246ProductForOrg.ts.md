# `server/bat246/scripts/seedBat246ProductForOrg.ts`

> One-off seed that creates a **$0** "Bat246 Board Entry" product in the BAT246 organisation specifically and wires it into boards that have no invite product.

**Kind:** backend one-off script (writes to the production DB) · **Lines:** 99

## Purpose
A targeted variant of `seedBat246Product.ts`. Instead of guessing the org from an admin user, it creates the entry product in one hard-coded organisation (the BAT246 office) with the BAT246 operator as `createdBy`, so the product appears only in that office's store. The header says it was written against a dev database ("roam-admin-dev"), but it connects to whatever `MONGODB_URI` points at, which in this project is **production**.

## How it works
1. `dotenv.config()`; `MONGO_URI = process.env.MONGODB_URI!` (no fallback - an unset variable makes `mongoose.connect` fail). Logs `DEV` if the URI contains the substring "dev", otherwise `PROD`.
2. Constants: `TARGET_ORG_ID` (the BAT246 org ObjectId, L17) and `TARGET_EMAIL` (the operator's email, L18).
3. Loads the organisation by id; exits with code 1 if missing (message suggests a `copyUserFromProd` script).
4. Loads the user by email; exits with code 1 if missing.
5. If a `Product` with that `organizationId` and tag `bat246_entry` exists, prints it and stops.
6. Otherwise creates the product with the same fields as `seedBat246Product.ts` (name, slug `bat246-board-entry`, SKU `BAT246-ENTRY-001`, digital, active, `tags: ["bat246_entry"]`) except `price: 0` and `createdBy` = the operator.
7. `Bat246Board.updateMany({ inviteProductId: { $exists: false } }, { $set: { inviteProductId: product._id } })` - only boards that have no invite product at all.
8. Logs and disconnects; errors exit with code 1.

## Exports
None.

## Interfaces
- **Database:**
  - `Organization` (collection `organizations`), `User` (collection `users`) - read.
  - `Product` (collection `products`) - read; create one.
  - `Bat246Board` (collection `bat246boards`) - update boards missing `inviteProductId`.
- **Environment variables:** `MONGODB_URI` - connection string (production; required).

## Dependencies
- **Internal:** `server/models/product.model.ts`, `server/models/organization.model.ts`, `server/models/user.model.ts`, `server/bat246/models/bat246Board.model.ts`.
- **Packages:** `mongoose`, `dotenv`.

## Used by
Not imported anywhere. Run by hand, e.g. `npx tsx server/bat246/scripts/seedBat246ProductForOrg.ts`.

## Notes
- The DEV/PROD label is only a substring test on the URI, not a safeguard; the script proceeds either way.
- A $0 product means entries bought through invite links on newly wired boards cost nothing.
- The board update is not scoped to the org despite the comment ("boards belonging to this org"): any board in the database without the field is wired. Boards whose field exists but is `null` are not touched.
- Error exits call `process.exit(1)` without disconnecting (harmless for a script).
