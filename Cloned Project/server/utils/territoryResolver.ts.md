# `server/utils/territoryResolver.ts`

> Module exporting `escapeRegex`, `caseInsensitiveExact`, `resolveLeafFromAddress`, `resolveLeafFromOrg`.

**Kind:** backend utility · **Lines:** 236

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `AddressInput` | interface |  | 16 |
| `escapeRegex` | function | `escapeRegex(value: string): string` | 23 |
| `caseInsensitiveExact` | function | `caseInsensitiveExact(value: string)` | 27 |
| `TerritoryLeafChain` | interface |  | 87 |
| `resolveLeafFromAddress` | function | `async resolveLeafFromAddress(addr: AddressInput): Promise<TerritoryLeafChain>` | 105 |
| `resolveLeafFromOrg` | function | `async resolveLeafFromOrg(orgId: Types.ObjectId \| string): Promise<TerritoryLeafChain \| null>` | 216 |

## Interfaces

- **Database (Mongoose models used):**
  - `FranchiseSubTerritory` (server/models/franchiseSubTerritory.model.ts) — reads: `findOne`, `countDocuments`
  - `FranchiseTerritory` (server/models/franchiseTerritory.model.ts) — reads: `findById`, `findOne`, `countDocuments`
  - `FranchiseCountry` (server/models/franchiseCountry.model.ts) — reads: `findOne`
  - `Organization` (server/models/organization.model.ts) — reads: `findById`

## Dependencies

- **Internal:**
  - `server/models/organization.model.ts` — `Organization`
  - `server/models/franchiseCountry.model.ts` — `FranchiseCountry`, `IFranchiseCountry`
  - `server/models/franchiseTerritory.model.ts` — `FranchiseTerritory`, `IFranchiseTerritory`
  - `server/models/franchiseSubTerritory.model.ts` — `FranchiseSubTerritory`, `IFranchiseSubTerritory`
- **Packages:**
  - `mongoose` — `Types`

## Used by

- `server/routes/franchiseGlobal.ts`
- `server/routes/franchiseGlobalPublic.ts`
- `server/routes/franchiseProgram.ts`
- `server/scripts/audit-partial-fanout.ts`
- `server/services/franchiseProgramCommission.ts`
- `server/services/territoryCommission.ts`
- `server/utils/buyerAddress.ts`
- `server/utils/franchiseGeoResolver.ts`
- `server/utils/officeCustomerAccess.ts`
