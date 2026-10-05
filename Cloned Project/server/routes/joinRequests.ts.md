# `server/routes/joinRequests.ts`

> Express router with 4 endpoints, mounted at `/join-requests`.

**Kind:** Express router · **Lines:** 417 · **Mounted at:** `/join-requests` (browser: `/backend/join-requests`)

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Endpoints (4)

| Method | Router path | Browser path | Middleware | Handler | Line |
|---|---|---|---|---|---|
| GET | `/pending` | `/backend/join-requests/pending` | `requireAuth`, `requireFounder` | inline | 105 |
| POST | `/:id/approve` | `/backend/join-requests/:id/approve` | `requireAuth`, `requireFounder` | inline | 146 |
| POST | `/:id/reject` | `/backend/join-requests/:id/reject` | `requireAuth`, `requireFounder` | inline | 279 |
| GET | `/all` | `/backend/join-requests/all` | `requireAuth`, `requireFounder` | inline | 373 |

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `default (router)` | default |  | 416 |

## Interfaces

- **Database (Mongoose models used):**
  - `Organization` (server/models/organization.model.ts) — reads: `findById`
  - `User` (server/models/user.model.ts) — reads: `countDocuments`, `findById`
  - `JoinRequest` (server/models/joinRequest.model.ts) — reads: `find`, `findOne`
  - `Invite` (server/models/invite.model.ts) — **writes:** `findOneAndUpdate`

## Dependencies

- **Internal:**
  - `server/middleware/auth.ts` — `requireAuth`
  - `server/utils/accessCheck.ts` — `hasFounderAccess`
  - `server/models/joinRequest.model.ts` — `JoinRequest`
  - `server/models/user.model.ts` — `User`
  - `server/models/organization.model.ts` — `Organization`
  - `server/models/invite.model.ts` — `Invite`
  - `server/services/otp.ts` — `createOtp`
  - `server/services/mailer.ts` — `sendMail`, `guestApprovalEmailTemplate`, `guestRejectionEmailTemplate`, `EMAIL_FROM_NOTIFICATION`, `senderForOrg`
  - `server/services/officeSubscription.ts` — `getActiveOfficeSubscription`
  - `server/models/officePlan.model.ts` — `IOfficePlan`
- **Packages:**
  - `express` — `Router`
  - `zod` — `z`
  - `mongoose` — `Types`

## Used by

- `server/app.ts`

Entry: mounted in `server/app.ts` at `/join-requests`.
