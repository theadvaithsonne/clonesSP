# `server/routes/franchiseGlobalPublic.ts`

> Express router with 2 endpoints, mounted at `/franchise-global-public`.

**Kind:** Express router · **Lines:** 150 · **Mounted at:** `/franchise-global-public` (browser: `/backend/franchise-global-public`)

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Endpoints (2)

| Method | Router path | Browser path | Middleware | Handler | Line |
|---|---|---|---|---|---|
| GET | `/assignments/all` | `/backend/franchise-global-public/assignments/all` | — | inline | 71 |
| GET | `/marketplace` | `/backend/franchise-global-public/marketplace` | — | inline | 101 |

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `default (router)` | default |  | 149 |

## Interfaces

- **Database (Mongoose models used):**
  - `FranchiseGlobalAssignment` (server/models/franchiseGlobalAssignment.model.ts) — reads: `find`

## Dependencies

- **Internal:**
  - `server/models/franchiseGlobalAssignment.model.ts` — `FranchiseGlobalAssignment`
  - `server/utils/territoryResolver.ts` — `caseInsensitiveExact`
- **Packages:**
  - `express` — `Router`, `Request`, `Response`
  - `mongoose` — `Types`

## Used by

- `server/app.ts`

Entry: mounted in `server/app.ts` at `/franchise-global-public`.
