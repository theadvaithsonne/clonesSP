# `server/scripts/fix-subterritory-objectids.ts`

> Migrate `franchise_sub_territories` docs that were inserted with ObjectId `_id` to String `_id` (matching the model schema, matching the other 57 rows in the collection).

**Kind:** backend one-off script (may write to the production DB) · **Lines:** 125

<!-- docgen:auto -->

## Purpose
Migrate `franchise_sub_territories` docs that were inserted with
ObjectId `_id` to String `_id` (matching the model schema, matching
the other 57 rows in the collection).

Background: 4 India sub-territories (Bengaluru Urban, Bengaluru Rural,
Hyderabad, Visakhapatnam) were seeded with `new ObjectId()` instead of
a hex-string _id like the rest. The Mongoose model declares
`_id: { type: String }`, so `FranchiseSubTerritory.findById(str)`
misses those 4 rows — the route at franchiseProgram.ts:491
(loadCatalogEntity) then 404s with "Catalog entity not found" when a
founder tries to assign one of them.

The fix: insert a copy of each stuck row with `_id = ObjectId.toHexString()`
(same 24 chars, but as a plain String), then delete the ObjectId original.
Referential integrity is preserved because franchise_territory_assignments
stores geoEntityId as a String (matches either type when compared). […]

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Exports

None — this file exports nothing.

## Interfaces

- **Raw collections:** `franchise_sub_territories`, `franchise_territory_assignments`
- **Environment variables (`process.env`):** `MONGODB_URI`

## Dependencies

- **Internal:** none
- **Packages:**
  - `dotenv`
  - `mongoose` — `Types`

## Used by

Entry: run by hand: `npx tsx server/scripts/fix-subterritory-objectids.ts`.

## Notes

- ⚠ **Connects to `MONGODB_URI`** — in this project that is the **production database** (see `.env`). No write operations were detected, but check the code before running.
- Command-line flags referenced: `--apply`.
