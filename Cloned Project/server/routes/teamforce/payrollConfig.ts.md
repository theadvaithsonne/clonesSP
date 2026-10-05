# `server/routes/teamforce/payrollConfig.ts`

> Express router with 3 endpoints.

**Kind:** Express router · **Lines:** 88

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Endpoints (3)

| Method | Router path | Browser path | Middleware | Handler | Line |
|---|---|---|---|---|---|
| GET | `/` | — | `requireAuth` | inline | 30 |
| PATCH | `/` | — | `requireAuth` | inline | 39 |
| POST | `/unlock` | — | `requireAuth` | inline | 71 |

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `default (router)` | default |  | 87 |

## Interfaces

- **Database (Mongoose models used):**
  - `TeamforcePayrollConfig` (server/models/teamforce/teamforcePayrollConfig.model.ts) — reads: `findOne`; **writes:** `create`, `findOneAndUpdate`

## Dependencies

- **Internal:**
  - `server/middleware/auth.ts` — `requireAuth`
  - `server/models/teamforce/teamforcePayrollConfig.model.ts` — `TeamforcePayrollConfig`
  - `server/routes/teamforce/_helpers.ts` — `getOrgIdStrict`, `requireTeamforceWriteAccess`, `requireFounderOnly`
- **Packages:**
  - `express` — `Router`
  - `zod` — `z`
  - `mongoose` — `Types`

## Used by

- `server/routes/teamforce/index.ts`
