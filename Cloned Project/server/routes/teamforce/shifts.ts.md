# `server/routes/teamforce/shifts.ts`

> Express router with 4 endpoints.

**Kind:** Express router · **Lines:** 132

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Endpoints (4)

| Method | Router path | Browser path | Middleware | Handler | Line |
|---|---|---|---|---|---|
| GET | `/` | — | `requireAuth` | inline | 13 |
| POST | `/` | — | `requireAuth` | inline | 27 |
| PATCH | `/:id` | — | `requireAuth` | inline | 65 |
| DELETE | `/:id` | — | `requireAuth` | inline | 118 |

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `default (router)` | default |  | 131 |

## Interfaces

- **Database (Mongoose models used):**
  - `TeamforceShift` (server/models/teamforce/teamforceShift.model.ts) — reads: `find`, `findOne`; **writes:** `create`, `findOneAndUpdate`

## Dependencies

- **Internal:**
  - `server/middleware/auth.ts` — `requireAuth`
  - `server/models/teamforce/teamforceShift.model.ts` — `TeamforceShift`
  - `server/routes/teamforce/_helpers.ts` — `getOrgIdStrict`, `requireTeamforceWriteAccess`
- **Packages:**
  - `express` — `Router`
  - `zod` — `z`
  - `mongoose` — `Types`

## Used by

- `server/routes/teamforce/index.ts`
