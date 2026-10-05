# `server/routes/teamforce/breakSettings.ts`

> Express router with 5 endpoints.

**Kind:** Express router · **Lines:** 251

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Endpoints (5)

| Method | Router path | Browser path | Middleware | Handler | Line |
|---|---|---|---|---|---|
| GET | `/` | — | `requireAuth` | inline | 54 |
| POST | `/` | — | `requireAuth` | inline | 67 |
| PATCH | `/:id` | — | `requireAuth` | inline | 91 |
| DELETE | `/:id` | — | `requireAuth` | inline | 120 |
| GET | `/status` | — | `requireAuth` | inline | 192 |

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `findApplicablePolicy` | function | `async findApplicablePolicy(userId: string, orgId: string): Promise<any \| null>` — Find the single break policy that currently applies to this user. | 145 |
| `default (router)` | default |  | 250 |

## Interfaces

- **Database (Mongoose models used):**
  - `TeamforceBreakSettings` (server/models/teamforce/teamforceBreakSettings.model.ts) — reads: `find`; **writes:** `create`, `findOneAndUpdate`, `findOneAndDelete`
  - `TeamforceEmployeeProfile` (server/models/teamforce/teamforceEmployeeProfile.model.ts) — reads: `findOne`
  - `TeamforceBreakLog` (server/models/teamforce/teamforceBreakLog.model.ts) — reads: `find`

## Dependencies

- **Internal:**
  - `server/middleware/auth.ts` — `requireAuth`
  - `server/models/teamforce/teamforceBreakSettings.model.ts` — `TeamforceBreakSettings`, `BREAK_SCOPE_TYPES`
  - `server/models/teamforce/teamforceBreakLog.model.ts` — `TeamforceBreakLog`
  - `server/models/teamforce/teamforceEmployeeProfile.model.ts` — `TeamforceEmployeeProfile`
  - `server/routes/teamforce/_helpers.ts` — `getAuthUser`, `getOrgIdStrict`, `requireTeamforceWriteAccess`
- **Packages:**
  - `express` — `Router`
  - `zod` — `z`
  - `mongoose` — `Types`

## Used by

- `server/routes/betty.ts`
- `server/routes/teamforce/index.ts`
