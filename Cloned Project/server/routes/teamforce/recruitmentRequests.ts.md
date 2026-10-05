# `server/routes/teamforce/recruitmentRequests.ts`

> Express router with 10 endpoints.

**Kind:** Express router · **Lines:** 378

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Endpoints (10)

| Method | Router path | Browser path | Middleware | Handler | Line |
|---|---|---|---|---|---|
| GET | `/public/:id` | — | — | inline | 56 |
| GET | `/` | — | `requireAuth` | inline | 77 |
| GET | `/:id` | — | `requireAuth` | inline | 120 |
| POST | `/` | — | `requireAuth` | inline | 141 |
| PATCH | `/:id` | — | `requireAuth` | inline | 162 |
| DELETE | `/:id` | — | `requireAuth` | inline | 235 |
| GET | `/:id/form` | — | `requireAuth` | inline | 266 |
| PUT | `/:id/form/draft` | — | `requireAuth` | inline | 291 |
| POST | `/:id/form/publish` | — | `requireAuth` | inline | 329 |
| GET | `/meta/access` | — | `requireAuth` | inline | 370 |

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `default (router)` | default |  | 377 |

## Interfaces

- **Database (Mongoose models used):**
  - `TeamforceRecruitmentRequest` (server/models/teamforce/teamforceRecruitmentRequest.model.ts) — reads: `findOne`, `countDocuments`, `find`; **writes:** `create`, `findOneAndUpdate`
  - `User` (server/models/user.model.ts) — reads: `findById`

## Dependencies

- **Internal:**
  - `server/middleware/auth.ts` — `requireAuth`
  - `server/models/teamforce/teamforceRecruitmentRequest.model.ts` — `TeamforceRecruitmentRequest`, `RECRUITMENT_STATUSES`, `EMPLOYMENT_TYPES`, `EXPERIENCE_RANGES`, `CUSTOM_FIELD_TYPES`
  - `server/models/user.model.ts` — `User`
  - `server/routes/teamforce/_helpers.ts` — `getAuthUser`, `getOrgIdStrict`, `hasRecruitmentAccess`, `requireRecruitmentAccess`
- **Packages:**
  - `express` — `Router`
  - `zod` — `z`
  - `mongoose` — `Types`

## Used by

- `server/routes/teamforce/index.ts`
