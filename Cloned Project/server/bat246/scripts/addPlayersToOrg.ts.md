# `server/bat246/scripts/addPlayersToOrg.ts`

> One-off backfill that adds every existing BAT246 player's Garage user account to the BAT246 organisation as a `member`.

**Kind:** backend one-off script (writes to the production DB) · **Lines:** 82

## Purpose
BAT246 players who were placed on boards before the "auto-add the player to the BAT246 org" logic existed never got the org membership. This script repairs that by walking every `Bat246Player` and appending the BAT246 organisation to the linked `User.organizations` array. It is run by hand; nothing in the app imports it.

## How it works
1. Loads `.env` from the current working directory with `dotenv.config()` and connects to `MONGODB_URI` (falls back to `mongodb://localhost:27017/garage` if unset). **In this project `MONGODB_URI` is the production database.**
2. Finds the BAT246 org indirectly: the first `Product` whose `tags` contain `"bat246_entry"`, and uses its `organizationId`. If none exists it logs an error, disconnects and exits with code 1 (the message suggests running `seedBat246Product.ts` first).
3. Loads all `Bat246Player` docs (`userId`, `nickname`, `email`).
4. For each player:
   - no `userId` -> logged as `SKIP`, counted as "no user";
   - `User.findById(userId)` returns nothing -> `SKIP`;
   - the user already has an `organizations[]` entry whose `organization` equals the org id -> `ALREADY IN ORG`;
   - otherwise `User.updateOne({ _id }, { $addToSet: { organizations: { organization: orgId, role: "member" } } })` -> `ADDED`.
5. Prints totals (added / already in org / skipped) and disconnects. Any thrown error is logged and the process exits with code 1.

The membership check makes the script safe to re-run: users already in the org are not touched.

## Exports
None. The file is an executable script whose top-level `run()` call does all the work.

## Interfaces
- **Database:**
  - `Product` (collection `products`) - read: one doc tagged `bat246_entry`, to get the org id.
  - `Bat246Player` (model `bat246Players`, collection `bat246players`) - read: all players.
  - `User` (collection `users`) - read by id; write: `$addToSet` onto `organizations`.
- **Environment variables:** `MONGODB_URI` - database connection string (production in this project).

## Dependencies
- **Internal:** `server/bat246/models/bat246Player.model.ts` - player records; `server/models/product.model.ts` - locates the BAT246 entry product; `server/models/user.model.ts` - Garage users and their org memberships.
- **Packages:** `mongoose` - DB connection and models; `dotenv` - loads `.env`.

## Used by
Nothing imports it. Run manually from the repo root, e.g. `npx tsx server/bat246/scripts/addPlayersToOrg.ts`. The header comment still shows the pre-merge path `src/bat246/scripts/...` with `ts-node`.

## Notes
- Writes to production user records. The role added is `"member"`, whereas the sibling script `addTestUsers10to19.ts` uses `"stakeholder"`; check which role the live auto-add path uses before re-running.
- `$addToSet` compares the whole sub-document, so it only de-duplicates exact `{ organization, role }` matches; the explicit membership check before it is what actually prevents duplicates.
- The org is resolved from "the first product tagged `bat246_entry`". If more than one org has such a product (see `tagBat246Products.ts`, `seedBat246ProductForOrg.ts`) the result depends on which product Mongo returns first.
