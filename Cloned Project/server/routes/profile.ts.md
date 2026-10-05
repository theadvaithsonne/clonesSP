# `server/routes/profile.ts`

> Express router with 5 endpoints, mounted at `/profile`.

**Kind:** Express router · **Lines:** 562 · **Mounted at:** `/profile` (browser: `/backend/profile`)

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Endpoints (5)

| Method | Router path | Browser path | Middleware | Handler | Line |
|---|---|---|---|---|---|
| POST | `/presigned-upload` | `/backend/profile/presigned-upload` | `requireAuth` | inline | 36 |
| GET | `/` | `/backend/profile` | — | inline | 85 |
| PUT | `/` | `/backend/profile` | — | inline | 187 |
| GET | `/status` | `/backend/profile/status` | — | inline | 458 |
| PUT | `/coordinates` | `/backend/profile/coordinates` | — | inline | 482 |

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `default (router)` | default |  | 561 |

## Interfaces

- **Database (Mongoose models used):**
  - `User` (server/models/user.model.ts) — reads: `findById`, `findOne`

## Dependencies

- **Internal:**
  - `server/middleware/auth.ts` — `requireAuth`
  - `server/services/twoFactorSms.ts` — `storablePhone`
  - `server/models/user.model.ts` — `User`
  - `server/models/organization.model.ts` — `Organization`
  - `server/utils/geocoding.ts` — `getCoordinatesFromAddress`
  - `server/utils/affiliateId.ts` — `generateAffiliateId`
  - `server/services/channel.ts` — `autoJoinEmployeesChannel`, `autoJoinDefaultChannel`
  - `server/services/s3.ts` — `s3Service`
- **Packages:**
  - `express` — `Router`
  - `mongoose`
  - `zod` — `z`

## Used by

- `server/app.ts`

Entry: mounted in `server/app.ts` at `/profile`.
