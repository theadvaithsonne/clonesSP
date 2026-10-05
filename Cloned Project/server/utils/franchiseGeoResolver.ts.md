# `server/utils/franchiseGeoResolver.ts`

> Module exporting `resolveGeoChainFromAddress`.

**Kind:** backend utility · **Lines:** 88

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `GeoChain` | interface | Founder-program geo resolution. | 29 |
| `resolveGeoChainFromAddress` | function | `async resolveGeoChainFromAddress(addr: AddressInput): Promise<GeoChain>` | 41 |

## Interfaces

- **Database (Mongoose models used):**
  - `FranchiseSubTerritory` (server/models/franchiseSubTerritory.model.ts) — reads: `findOne`
  - `FranchiseTerritory` (server/models/franchiseTerritory.model.ts) — reads: `findById`, `findOne`
  - `FranchiseCountry` (server/models/franchiseCountry.model.ts) — reads: `findOne`

## Dependencies

- **Internal:**
  - `server/models/franchiseCountry.model.ts` — `FranchiseCountry`, `IFranchiseCountry`
  - `server/models/franchiseTerritory.model.ts` — `FranchiseTerritory`, `IFranchiseTerritory`
  - `server/models/franchiseSubTerritory.model.ts` — `FranchiseSubTerritory`, `IFranchiseSubTerritory`
  - `server/utils/territoryResolver.ts` — `AddressInput`, `caseInsensitiveExact`
- **Packages:** none

## Used by

- `server/services/franchiseProgramCommission.ts`
- `server/services/territoryCommission.ts`
