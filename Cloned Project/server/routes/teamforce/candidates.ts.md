# `server/routes/teamforce/candidates.ts`

> Express router with 7 endpoints.

**Kind:** Express router · **Lines:** 442

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Endpoints (7)

| Method | Router path | Browser path | Middleware | Handler | Line |
|---|---|---|---|---|---|
| POST | `/:requestId/apply` | — | `requireAuth`, `upload.any()` | inline | 46 |
| POST | `/public/:requestId/apply` | — | `upload.any()` | inline | 169 |
| GET | `/` | — | `requireAuth` | inline | 285 |
| GET | `/:id/resume` | — | `requireAuth` | inline | 332 |
| GET | `/:id/custom-file/:fieldId` | — | `requireAuth` | inline | 361 |
| PATCH | `/:id` | — | `requireAuth` | inline | 402 |
| DELETE | `/:id` | — | `requireAuth` | inline | 425 |

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `default (router)` | default |  | 441 |

## Interfaces

- **Database (Mongoose models used):**
  - `TeamforceRecruitmentRequest` (server/models/teamforce/teamforceRecruitmentRequest.model.ts) — reads: `findOne`
  - `TeamforceCandidate` (server/models/teamforce/teamforceCandidate.model.ts) — reads: `countDocuments`, `find`, `findOne`; **writes:** `create`, `findOneAndUpdate`

## Dependencies

- **Internal:**
  - `server/middleware/auth.ts` — `requireAuth`
  - `server/services/s3.ts` — `s3Service`
  - `server/models/teamforce/teamforceCandidate.model.ts` — `TeamforceCandidate`, `CANDIDATE_STAGES`
  - `server/models/teamforce/teamforceRecruitmentRequest.model.ts` — `TeamforceRecruitmentRequest`
  - `server/routes/teamforce/_helpers.ts` — `getAuthUser`, `getOrgIdStrict`, `requireRecruitmentAccess`
- **Packages:**
  - `express` — `Router`
  - `multer`
  - `zod` — `z`
  - `mongoose` — `Types`

## Used by

- `server/routes/teamforce/index.ts`
