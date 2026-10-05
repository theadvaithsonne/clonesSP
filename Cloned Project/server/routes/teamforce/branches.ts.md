# `server/routes/teamforce/branches.ts`

> Express router with 4 endpoints.

**Kind:** Express router · **Lines:** 121

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Endpoints (4)

| Method | Router path | Browser path | Middleware | Handler | Line |
|---|---|---|---|---|---|
| GET | `/` | — | `requireAuth` | inline | 14 |
| POST | `/` | — | `requireAuth` | inline | 29 |
| PATCH | `/:id` | — | `requireAuth` | inline | 66 |
| DELETE | `/:id` | — | `requireAuth` | inline | 107 |

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `default (router)` | default |  | 120 |

## Interfaces

- **Database (Mongoose models used):**
  - `TeamforceBranch` (server/models/teamforce/teamforceBranch.model.ts) — reads: `find`, `findOne`; **writes:** `create`, `findOneAndUpdate`

## Dependencies

- **Internal:**
  - `server/middleware/auth.ts` — `requireAuth`
  - `server/models/teamforce/teamforceBranch.model.ts` — `TeamforceBranch`
  - `server/routes/teamforce/_helpers.ts` — `getOrgIdStrict`, `requireTeamforceWriteAccess`
- **Packages:**
  - `express` — `Router`
  - `zod` — `z`
  - `mongoose` — `Types`

## Used by

- `server/routes/teamforce/index.ts`
