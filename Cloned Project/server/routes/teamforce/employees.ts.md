# `server/routes/teamforce/employees.ts`

> Express router with 6 endpoints.

**Kind:** Express router · **Lines:** 576

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Endpoints (6)

| Method | Router path | Browser path | Middleware | Handler | Line |
|---|---|---|---|---|---|
| GET | `/` | — | `requireAuth` | inline | 34 |
| GET | `/:userId` | — | `requireAuth` | inline | 171 |
| POST | `/` | — | `requireAuth` | inline | 223 |
| PATCH | `/:userId` | — | `requireAuth` | inline | 407 |
| PATCH | `/:userId/role` | — | `requireAuth` | inline | 523 |
| DELETE | `/:userId/profile` | — | `requireAuth` | inline | 562 |

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `default (router)` | default |  | 575 |

## Interfaces

- **Database (Mongoose models used):**
  - `User` (server/models/user.model.ts) — reads: `find`, `findOne`; **writes:** `create`, `findByIdAndUpdate`
  - `TeamforceEmployeeProfile` (server/models/teamforce/teamforceEmployeeProfile.model.ts) — reads: `find`, `findOne`; **writes:** `findOneAndUpdate`, `deleteOne`
  - `Invite` (server/models/invite.model.ts) — reads: `find`

## Dependencies

- **Internal:**
  - `server/middleware/auth.ts` — `requireAuth`
  - `server/models/user.model.ts` — `User`
  - `server/models/invite.model.ts` — `Invite`
  - `server/models/teamforce/teamforceEmployeeProfile.model.ts` — `TeamforceEmployeeProfile`
  - `server/routes/teamforce/_helpers.ts` — `getAuthUser`, `getOrgIdStrict`, `hasFullAccess`, `requireTeamforceWriteAccess`, `requireFounderOnly`, `stripSensitive`, `SENSITIVE_FIELDS`, `MANAGER_ONLY_FIELDS`
- **Packages:**
  - `express` — `Router`
  - `zod` — `z`
  - `mongoose` — `Types`

## Used by

- `server/routes/teamforce/index.ts`
