# `server/models/franchiseCountry.model.ts`

> Read-only Mongoose mirror of the `franchise_countries` collection, which belongs to the external franchise app. Documents use string `_id`s.

**Kind:** Mongoose model · **Lines:** 43

## Purpose
Country-level franchises (territories) are owned and managed by a separate franchise application, named in the comment as roam-admin-prod. Its data sits in the same MongoDB. The Garage backend only **reads** this collection: to resolve which country franchise owns a buyer's geography, check entity access, and sync catalog ownership. The comment states that Garage never writes it.

## How it works
- Interface `IFranchiseCountry`: `_id` (string), optional `id`, `name`, `region`, `status` (known values `available | taken | resale | auction`, but typed as an open string), `ownerEmail` (string or null), and `territoryIds[]` (string ids of child territories).
- Schema: `_id` declared as `String`, `name` and `status` indexed, other fields untyped strings.
- Schema options:
  - `collection: "franchise_countries"` pins the collection name.
  - `strict: false` preserves and returns extra fields the franchise app stores.
  - `timestamps: false`, because the franchise app owns its own timestamps.
  - `_id: false` stops Mongoose from auto-generating ObjectIds, since `_id` comes from the source data as a string.
- Compound index `{ name, status }`.

## Exports
- `IFranchiseCountry` - interface.
- `FranchiseCountry` - the model.

## Interfaces
- **Database:** `FranchiseCountry` (collection `franchise_countries`) - read by the server code.
- **External services:** the franchise app (roam-admin-prod) owns and writes the collection.

## Dependencies
- **Packages:** `mongoose`.

## Used by
- Routes: `franchiseApi.ts` (`/franchise-api`), `franchiseEntity.ts` (`/franchise-entity`), `franchiseGlobal.ts` (`/franchise-global`), `franchiseProgram.ts` (`/franchise-program`).
- Services and utils: `server/services/franchiseCatalogSync.ts`, `server/utils/entityAccess.ts`, `server/utils/franchiseGeoResolver.ts`, `server/utils/territoryResolver.ts`.
- `server/scripts/backfill-catalog-ownership.ts` - a manual maintenance script run against MONGODB_URI, which is the **production** database.
- `scripts/test-franchise-e2e.ts` - a manual test script that **creates** a test country (`name: "Testland"`) in this collection and deletes it again during cleanup. Because MONGODB_URI is production, it writes to and deletes from the franchise app's live collection.

## Notes
- The "never writes" rule holds for the server code but not for `scripts/test-franchise-e2e.ts`. If that script aborts before cleanup, it can leave a fake country behind in production.
- Without `strict: false`, saving a document through this model could strip the franchise app's extra fields. Keep the option, and avoid saving documents through this model at all.
