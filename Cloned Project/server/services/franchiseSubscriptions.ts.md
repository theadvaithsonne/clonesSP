# `server/services/franchiseSubscriptions.ts`

> Module exporting `expireFranchiseSubscriptions`.

**Kind:** backend service · **Lines:** 60

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `expireFranchiseSubscriptions` | function | `async expireFranchiseSubscriptions(): Promise<{ programsSuspended: number; assignmentsP…` — Daily sweep: pause franchise subscriptions whose yearly window has lapsed. | 23 |

## Interfaces

- **Database (Mongoose models used):**
  - `FranchiseProgram` (server/models/franchiseProgram.model.ts) — **writes:** `updateMany`
  - `FranchiseTerritoryAssignment` (server/models/franchiseTerritoryAssignment.model.ts) — **writes:** `updateMany`
  - `FranchiseGlobalAssignment` (server/models/franchiseGlobalAssignment.model.ts) — **writes:** `updateMany`

## Dependencies

- **Internal:**
  - `server/models/franchiseProgram.model.ts` — `FranchiseProgram`
  - `server/models/franchiseTerritoryAssignment.model.ts` — `FranchiseTerritoryAssignment`
  - `server/models/franchiseGlobalAssignment.model.ts` — `FranchiseGlobalAssignment`
- **Packages:** none

## Used by

- `server/routes/invoice.ts`
