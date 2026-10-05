# `server/services/garageAdminInit.ts`

> Module exporting `initializeGarageSuperAdmin`.

**Kind:** backend service · **Lines:** 38

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `initializeGarageSuperAdmin` | function | `async initializeGarageSuperAdmin()` | 3 |

## Interfaces

- **Database (Mongoose models used):**
  - `GarageAdminModel` (server/models/garageAdmin.model.ts) — reads: `findOne`; **writes:** `create`

## Dependencies

- **Internal:**
  - `server/models/garageAdmin.model.ts` — `GarageAdminModel`
- **Packages:** none

## Used by

- `server/services/init.ts`
