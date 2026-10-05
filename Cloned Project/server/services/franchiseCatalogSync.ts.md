# `server/services/franchiseCatalogSync.ts`

> Module exporting `syncCatalogOwner`.

**Kind:** backend service · **Lines:** 139

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `syncCatalogOwner` | function | `async syncCatalogOwner(geoLevel: EntityLevel, geoEntityId: string, ownerEmail: string \| null): Promise<boolean>` | 68 |

## Interfaces

None detected: no endpoints, events, data access or environment reads were found.

## Dependencies

- **Internal:**
  - `server/models/franchiseCountry.model.ts` — `FranchiseCountry`
  - `server/models/franchiseTerritory.model.ts` — `FranchiseTerritory`
  - `server/models/franchiseSubTerritory.model.ts` — `FranchiseSubTerritory`
- **Packages:**
  - `mongoose` — `Types`

## Used by

- `server/routes/franchiseGlobal.ts`
- `server/services/invoice.ts`
