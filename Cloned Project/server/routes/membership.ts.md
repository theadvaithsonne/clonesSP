# `server/routes/membership.ts`

> Express router with 7 endpoints, mounted at `/`.

**Kind:** Express router · **Lines:** 540 · **Mounted at:** `/` (browser: `/backend`)

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Endpoints (7)

| Method | Router path | Browser path | Middleware | Handler | Line |
|---|---|---|---|---|---|
| DELETE | `/org/:orgId/members/:memberId` | `/backend/org/:orgId/members/:memberId` | `requireAuth`, `requireOrgFounder` | inline | 24 |
| PATCH | `/org/:orgId/members/:memberId/access` | `/backend/org/:orgId/members/:memberId/access` | `requireAuth`, `requireOrgFounder` | inline | 106 |
| POST | `/org/:orgId/leave` | `/backend/org/:orgId/leave` | `requireAuth` | inline | 185 |
| DELETE | `/org/:orgId/members/:memberId/permanent` | `/backend/org/:orgId/members/:memberId/permanent` | `requireAuth`, `requireOrgFounder` | inline | 253 |
| POST | `/auth/account/deletion-request` | `/backend/auth/account/deletion-request` | `requireAuth` | inline | 333 |
| DELETE | `/auth/account` | `/backend/auth/account` | `requireAuth` | inline | 398 |
| GET | `/auth/account/status` | `/backend/auth/account/status` | `requireAuth` | inline | 487 |

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `default (router)` | default |  | 539 |

## Interfaces

- **Database (Mongoose models used):**
  - `User` (server/models/user.model.ts) — reads: `findById`

## Dependencies

- **Internal:**
  - `server/middleware/auth.ts` — `requireAuth`
  - `server/utils/accessCheck.ts` — `hasFounderAccess`
  - `server/middleware/roles.ts` — `requireOrgFounder`
  - `server/services/memberCleanup.service.ts` — `memberCleanupService`
  - `server/models/user.model.ts` — `User`
  - `server/models/organization.model.ts` — `Organization`
  - `server/services/otp.ts` — `createOtp`, `verifyOtp`
  - `server/services/mailer.ts` — `sendMail`, `accountDeletionOtpTemplate`, `EMAIL_FROM_OTP`, `senderForHost`
- **Packages:**
  - `express` — `Router`, `Request`, `Response`
  - `zod` — `z`

## Used by

- `server/app.ts`

Entry: mounted in `server/app.ts` at `/`.
