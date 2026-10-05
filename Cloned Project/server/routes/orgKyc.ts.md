# `server/routes/orgKyc.ts`

> Founder-facing office KYC — read what the admin asked for, upload the documents, submit for review.

**Kind:** Express router · **Lines:** 334 · **Mounted at:** `/org-kyc` (browser: `/backend/org-kyc`)

<!-- docgen:auto -->

## Purpose
Founder-facing office KYC — read what the admin asked for, upload the
documents, submit for review.

Mounted at /org-kyc. The admin side (setting requirements, approving,
verifying) is routes/garageAdminOrgKyc.ts.

Files never pass through this server: the browser asks for a presigned PUT
into the private KYC bucket, uploads straight to S3, then POSTs the
resulting key here. See services/orgKycStorage.ts.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Endpoints (6)

| Method | Router path | Browser path | Middleware | Handler | Line |
|---|---|---|---|---|---|
| GET | `/me` | `/backend/org-kyc/me` | `requireAuth` | inline | 96 |
| GET | `/:orgId` | `/backend/org-kyc/:orgId` | `requireAuth` | inline | 126 |
| POST | `/:orgId/upload-url` | `/backend/org-kyc/:orgId/upload-url` | `requireAuth` | inline | 137 |
| POST | `/:orgId/submissions` | `/backend/org-kyc/:orgId/submissions` | `requireAuth` | inline | 180 |
| DELETE | `/:orgId/submissions/:submissionId` | `/backend/org-kyc/:orgId/submissions/:submissionId` | `requireAuth` | inline | 265 |
| POST | `/:orgId/submit` | `/backend/org-kyc/:orgId/submit` | `requireAuth` | inline | 301 |

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `default (router)` | default |  | 333 |

## Interfaces

- **Database (Mongoose models used):**
  - `User` (server/models/user.model.ts) — reads: `findById`
  - `OrgKyc` (server/models/orgKyc.model.ts) — reads: `findOne`

## Dependencies

- **Internal:**
  - `server/middleware/auth.ts` — `requireAuth`
  - `server/models/user.model.ts` — `User`
  - `server/models/orgKyc.model.ts` — `OrgKyc`
  - `server/services/orgKyc.service.ts` — `getOrCreateOrgKyc`, `missingRequirements`, `OrgKycError`, `requirementsSatisfied`, `serializeOrgKyc`, `syncOrgKycMirror`
  - `server/services/orgKycStorage.ts` — `deleteKycObject`, `KycUploadValidationError`, `presignKycUpload`
- **Packages:**
  - `express` — `Router`, `Request`, `Response`
  - `mongoose` — `Types`

## Used by

- `server/app.ts`

Entry: mounted in `server/app.ts` at `/org-kyc`.
