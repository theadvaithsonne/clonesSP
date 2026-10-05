# `server/routes/teamforce/leaveRequests.ts`

> Express router with 7 endpoints.

**Kind:** Express router · **Lines:** 300

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Endpoints (7)

| Method | Router path | Browser path | Middleware | Handler | Line |
|---|---|---|---|---|---|
| POST | `/` | — | `requireAuth` | inline | 52 |
| GET | `/mine` | — | `requireAuth` | inline | 91 |
| GET | `/` | — | `requireAuth` | inline | 110 |
| GET | `/team` | — | `requireAuth` | inline | 152 |
| POST | `/:id/approve` | — | `requireAuth` | inline | 267 |
| POST | `/:id/reject` | — | `requireAuth` | inline | 270 |
| POST | `/:id/cancel` | — | `requireAuth` | inline | 275 |

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `default (router)` | default |  | 299 |

## Interfaces

- **Database (Mongoose models used):**
  - `TeamforceEmployeeProfile` (server/models/teamforce/teamforceEmployeeProfile.model.ts) — reads: `findOne`
  - `TeamforceLeaveRequest` (server/models/teamforce/teamforceLeaveRequest.model.ts) — reads: `find`, `findOne`; **writes:** `create`, `findOneAndUpdate`
  - `User` (server/models/user.model.ts) — reads: `findById`

## Dependencies

- **Internal:**
  - `server/middleware/auth.ts` — `requireAuth`
  - `server/models/teamforce/teamforceLeaveRequest.model.ts` — `TeamforceLeaveRequest`, `LEAVE_TYPES`, `ApproverScope`
  - `server/models/teamforce/teamforceEmployeeProfile.model.ts` — `TeamforceEmployeeProfile`
  - `server/models/user.model.ts` — `User`
  - `server/routes/teamforce/_helpers.ts` — `getAuthUser`, `getOrgIdStrict`, `hasFullAccess`
- **Packages:**
  - `express` — `Router`
  - `zod` — `z`
  - `mongoose` — `Types`

## Used by

- `server/routes/teamforce/index.ts`
