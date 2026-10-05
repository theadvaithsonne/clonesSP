# `server/utils/officeCustomerAccess.ts`

> Module exporting `canAccessOfficeCustomers`.

**Kind:** backend utility · **Lines:** 122

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `canAccessOfficeCustomers` | function | `async canAccessOfficeCustomers(userId: string, officeId: string): Promise<{ allowed: boolean; reason: \| "office_fou…` — Returns true iff `userId` is allowed to view the customer roster of office `officeId`. | 24 |

## Interfaces

- **Database (Mongoose models used):**
  - `User` (server/models/user.model.ts) — reads: `findById`
  - `FranchiseTerritoryAssignment` (server/models/franchiseTerritoryAssignment.model.ts) — reads: `exists`
  - `FranchiseGlobalAssignment` (server/models/franchiseGlobalAssignment.model.ts) — reads: `exists`

## Dependencies

- **Internal:**
  - `server/models/user.model.ts` — `User`
  - `server/models/franchiseTerritoryAssignment.model.ts` — `FranchiseTerritoryAssignment`
  - `server/models/franchiseGlobalAssignment.model.ts` — `FranchiseGlobalAssignment`
  - `server/utils/accessCheck.ts` — `hasFounderAccess`
  - `server/utils/territoryResolver.ts` — `resolveLeafFromOrg`
  - `server/services/commission.ts` — `PLATFORM_USER_EMAIL`
- **Packages:**
  - `mongoose` — `Types`

## Used by

- `server/routes/orgCustomers.ts`
