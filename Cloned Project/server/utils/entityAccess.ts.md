# `server/utils/entityAccess.ts`

> Module exporting `loadEntityWithAncestors`, `canAccessEntity`.

**Kind:** backend utility · **Lines:** 161

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `EntityLevel` | type |  | 10 |
| `loadEntityWithAncestors` | function | `async loadEntityWithAncestors(level: EntityLevel, entityId: string): Promise<Array<{ level: EntityLevel; id: string; e…` — Compute the ancestor chain of a franchise catalog entity, starting from itself and walking UP to the country. | 24 |
| `canAccessEntity` | function | `async canAccessEntity(userId: string, level: EntityLevel, entityId: string): Promise<{ allowed: boolean; reason: \| "platform_a…` — Returns true iff `userId` is allowed to view detail (customers, affiliates) for the given franchise entity. | 97 |

## Interfaces

- **Database (Mongoose models used):**
  - `FranchiseSubTerritory` (server/models/franchiseSubTerritory.model.ts) — reads: `findById`
  - `FranchiseTerritory` (server/models/franchiseTerritory.model.ts) — reads: `findOne`, `findById`
  - `FranchiseCountry` (server/models/franchiseCountry.model.ts) — reads: `findOne`, `findById`
  - `User` (server/models/user.model.ts) — reads: `findById`
  - `FranchiseGlobalAssignment` (server/models/franchiseGlobalAssignment.model.ts) — reads: `exists`
  - `FranchiseTerritoryAssignment` (server/models/franchiseTerritoryAssignment.model.ts) — reads: `exists`

## Dependencies

- **Internal:**
  - `server/models/user.model.ts` — `User`
  - `server/models/franchiseCountry.model.ts` — `FranchiseCountry`
  - `server/models/franchiseTerritory.model.ts` — `FranchiseTerritory`
  - `server/models/franchiseSubTerritory.model.ts` — `FranchiseSubTerritory`
  - `server/models/franchiseTerritoryAssignment.model.ts` — `FranchiseTerritoryAssignment`
  - `server/models/franchiseGlobalAssignment.model.ts` — `FranchiseGlobalAssignment`
  - `server/services/commission.ts` — `PLATFORM_USER_EMAIL`
- **Packages:**
  - `mongoose` — `Types`

## Used by

- `server/routes/franchiseEntity.ts`
