# `server/routes/garageAdminOrgKyc.ts`

> Garage-admin side of office KYC.

**Kind:** Express router · **Lines:** 401 · **Mounted at:** `/garage-admin` (browser: `/backend/garage-admin`)

<!-- docgen:auto -->

## Purpose
Garage-admin side of office KYC.

  GET    /garage-admin/org-kyc                      office list (?status, ?q)
  GET    /garage-admin/org-kyc/defaults             built-in requirement catalog
  GET    /garage-admin/org-kyc/:orgId               one office, with view URLs
  PUT    /garage-admin/org-kyc/:orgId/requirements  pick what this office owes
  POST   /garage-admin/org-kyc/:orgId/submissions/:id/decision   approve/reject one
  POST   /garage-admin/org-kyc/:orgId/verify        office becomes verified
  POST   /garage-admin/org-kyc/:orgId/reject        send it back with a note

Page-gated as `org_kyc` (config/adminPages.ts) — its own grantable page,
not a corner of `organizations`: identity documents are a narrower thing to
hand an admin than an office listing. GET is view, every write is manage.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Endpoints (7)

| Method | Router path | Browser path | Middleware | Handler | Line |
|---|---|---|---|---|---|
| GET | `/org-kyc/defaults` | `/backend/garage-admin/org-kyc/defaults` | `requireGarageAdminAuth` | inline | 63 |
| GET | `/org-kyc` | `/backend/garage-admin/org-kyc` | `requireGarageAdminAuth` | inline | 78 |
| GET | `/org-kyc/:orgId` | `/backend/garage-admin/org-kyc/:orgId` | `requireGarageAdminAuth` | inline | 183 |
| PUT | `/org-kyc/:orgId/requirements` | `/backend/garage-admin/org-kyc/:orgId/requirements` | `requireGarageAdminAuth` | inline | 211 |
| POST | `/org-kyc/:orgId/submissions/:submissionId/decision` | `/backend/garage-admin/org-kyc/:orgId/submissions/:submissionId/decision` | `requireGarageAdminAuth` | inline | 264 |
| POST | `/org-kyc/:orgId/verify` | `/backend/garage-admin/org-kyc/:orgId/verify` | `requireGarageAdminAuth` | inline | 300 |
| POST | `/org-kyc/:orgId/reject` | `/backend/garage-admin/org-kyc/:orgId/reject` | `requireGarageAdminAuth` | inline | 354 |

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `default (router)` | default |  | 400 |

## Interfaces

- **Database (Mongoose models used):**
  - `Organization` (server/models/organization.model.ts) — reads: `find`, `findById`
  - `OrgKyc` (server/models/orgKyc.model.ts) — reads: `find`
  - `User` (server/models/user.model.ts) — reads: `find`

## Dependencies

- **Internal:**
  - `server/middleware/garageAdminAuth.ts` — `requireGarageAdminAuth`, `GarageAdminRequest`
  - `server/models/orgKyc.model.ts` — `OrgKyc`
  - `server/models/organization.model.ts` — `Organization`
  - `server/models/user.model.ts` — `User`
  - `server/services/orgKyc.service.ts` — `DEFAULT_KYC_REQUIREMENTS`, `getOrCreateOrgKyc`, `missingRequirements`, `normalizeRequirements`, `OrgKycError`, `serializeOrgKyc`, `syncOrgKycMirror`
  - `server/services/orgKycStorage.ts` — `deleteKycObject`
  - `server/services/orgKycEmail.ts` — `sendOrgKycVerdictEmail`
  - `server/utils/http.ts` — `ok`, `fail`
- **Packages:**
  - `express` — `Router`
  - `mongoose` — `Types`

## Used by

- `server/app.ts`

Entry: mounted in `server/app.ts` at `/garage-admin`.
