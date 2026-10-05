# `server/models/franchiseTerritory.model.ts`

> Read-only Mongoose mirror of the external `franchise_territorymasters` collection (state-level franchise entities).

**Kind:** Mongoose model · **Lines:** 52

## Purpose
The middle level of the franchise geography catalog (country -> territory -> sub-territory). The catalog is owned by the franchise app at roam-admin-prod; Garage reads it to resolve and display territories and to find their sub-territories. Ownership and pricing live in the Garage assignment models, not here.

## How it works
- String `_id`s (`_id: { type: String }`, schema option `_id: false`).
- Fields: `externalKey`, `id`, `country`, `name`, `region`, `status` (`"available" | "taken" | "resale" | "auction"` or any string), `ownerEmail` (legacy owner), `parentId`, `hasSubTerritories`, `subTerritoryIds`.
- `strict: false` (extra fields from the external app are preserved), `timestamps: false`.
- Indexes: single-field on `country`, `name`, `status`; compound `{ country, name }` and `{ country, status }`.

## Exports
- `FranchiseTerritory` - model `"FranchiseTerritory"` bound to collection `franchise_territorymasters`.
- `IFranchiseTerritory` - document interface.

## Interfaces
- **Database:** collection `franchise_territorymasters` - read (owned externally).

## Dependencies
- **Packages:** `mongoose`.

## Used by
`server/utils/territoryResolver.ts`, `server/utils/franchiseGeoResolver.ts`, `server/utils/entityAccess.ts`, `server/services/franchiseCatalogSync.ts`, routes `server/routes/franchiseApi.ts` (`/franchise-api`), `franchiseEntity.ts` (`/franchise-entity`), `franchiseGlobal.ts` (`/franchise-global`), `franchiseProgram.ts` (`/franchise-program`), and manual scripts `server/scripts/backfill-catalog-ownership.ts` and `scripts/test-franchise-e2e.ts`.

## Notes
- As with `franchiseSubTerritory.model.ts`, "read-only" is a convention, not enforced; index declarations here can create indexes on the external collection when index sync runs.
