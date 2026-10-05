# `server/bat246/scripts/findBat246Org.ts`

> Read-only diagnostic script that lists organisations and products whose names look like "bat" or "246".

**Kind:** backend one-off script (read-only, connects to the production DB) · **Lines:** 27

## Purpose
A quick lookup used to discover the BAT246 organisation's ObjectId and its products, which several other scripts in this folder hard-code (for example `BAT246_ORG_ID` in `createAlanKFreeCoupon.ts` and `tagBat246Products.ts`).

## How it works
- `dotenv.config()`, connect to `MONGODB_URI` (fallback `mongodb://localhost:27017/garage`). **`MONGODB_URI` is the production database in this project.**
- Uses the raw driver (`mongoose.connection.db`), not Mongoose models:
  - `organizations`: `find({ name: /bat|246/i })`, projecting `_id`, `name`.
  - `products`: `find({ name: /bat|246/i })`, projecting `_id`, `name`, `organizationId`, `tags`.
- Prints both result sets as JSON, then disconnects. Errors exit with code 1.

It writes nothing.

## Exports
None.

## Interfaces
- **Database:** collections `organizations` and `products` - read only.
- **Environment variables:** `MONGODB_URI` - connection string (production).

## Dependencies
- **Packages:** `mongoose` - connection and raw collection access; `dotenv` - loads `.env`.

## Used by
Not imported anywhere. Run by hand, e.g. `npx tsx server/bat246/scripts/findBat246Org.ts`.

## Notes
The case-insensitive `bat` pattern also matches unrelated names containing "bat" (for example "battery" or "combat").
