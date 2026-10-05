# `server/routes/teamforce/ptSlabs.ts`

> Express router with 5 endpoints.

**Kind:** Express router · **Lines:** 102

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Endpoints (5)

| Method | Router path | Browser path | Middleware | Handler | Line |
|---|---|---|---|---|---|
| GET | `/` | — | `requireAuth` | inline | 25 |
| POST | `/` | — | `requireAuth` | inline | 37 |
| PATCH | `/:id` | — | `requireAuth` | inline | 50 |
| DELETE | `/:id` | — | `requireAuth` | inline | 67 |
| POST | `/seed` | — | `requireAuth` | inline | 79 |

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `default (router)` | default |  | 101 |

## Interfaces

- **Database (Mongoose models used):**
  - `TeamforcePTSlab` (server/models/teamforce/teamforcePTSlab.model.ts) — reads: `find`, `findOne`; **writes:** `create`, `findOneAndUpdate`

## Dependencies

- **Internal:**
  - `server/middleware/auth.ts` — `requireAuth`
  - `server/models/teamforce/teamforcePTSlab.model.ts` — `TeamforcePTSlab`, `PT_STATES`, `SEED_PT_SLABS`
  - `server/routes/teamforce/_helpers.ts` — `requireFounderOnly`
- **Packages:**
  - `express` — `Router`
  - `zod` — `z`

## Used by

- `server/routes/teamforce/index.ts`
