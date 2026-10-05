# `server/models/franchiseSubTerritory.model.ts`

> Read-only Mongoose mirror of the external `franchise_sub_territories` collection (city-level franchise entities).

**Kind:** Mongoose model · **Lines:** 56

## Purpose
The franchise geography catalog (country -> territory -> sub-territory) is owned by the separate franchise app at roam-admin-prod and lives in the same database. This model lets Garage read sub-territories, chiefly to map a postal code to a city-level entity via `zipCodes`. Garage does not write to this collection; ownership and pricing live in `FranchiseGlobalAssignment` / `FranchiseTerritoryAssignment`.

## How it works
- Documents use string `_id`s (`_id: { type: String }` with the schema option `_id: false` so Mongoose does not add an ObjectId).
- Fields: `externalKey`, `id`, `country`, `parentTerritory`, `name`, `region`, `status` (`"available" | "taken" | "resale" | "auction"` or any string), `ownerEmail` (legacy owner), `parentId`, `parentTerritoryId`, `zipCodes`.
- `strict: false` keeps any extra fields the external app stores; `timestamps: false`.
- Indexes: single-field on `country`, `parentTerritory`, `name`, `status`, `zipCodes`; compound `{ zipCodes, status }` (postal-code lookup) and `{ country, parentTerritory, name }`.

## Exports
- `FranchiseSubTerritory` - model `"FranchiseSubTerritory"` bound to collection `franchise_sub_territories`.
- `IFranchiseSubTerritory` - document interface.

## Interfaces
- **Database:** collection `franchise_sub_territories` - read (owned externally).

## Dependencies
- **Packages:** `mongoose`.

## Used by
`server/utils/territoryResolver.ts` and `server/utils/franchiseGeoResolver.ts` (postal code to sub-territory), `server/utils/entityAccess.ts`, `server/services/franchiseCatalogSync.ts`, routes `server/routes/franchiseApi.ts` (`/franchise-api`), `franchiseEntity.ts` (`/franchise-entity`), `franchiseGlobal.ts` (`/franchise-global`), `franchiseProgram.ts` (`/franchise-program`), and manual scripts `server/scripts/backfill-catalog-ownership.ts`, `server/scripts/smoke-test-franchise-global.ts`, `scripts/test-franchise-e2e.ts`.

## Notes
- The declared indexes would be built on the externally owned collection whenever `autoIndex` is on (non-production by default, see `server/db/mongo.ts`) or when `npm run indexes:sync` runs.
- Treat the "read-only" description as a convention: Mongoose does not enforce it, so check any script that imports this model before running it against the production database.
