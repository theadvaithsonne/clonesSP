# `server/routes/invites.ts`

> Express router with 5 endpoints, mounted at `/invites`.

**Kind:** Express router · **Lines:** 393 · **Mounted at:** `/invites` (browser: `/backend/invites`)

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Endpoints (5)

| Method | Router path | Browser path | Middleware | Handler | Line |
|---|---|---|---|---|---|
| POST | `/create` | `/backend/invites/create` | `requireAuth`, `requireOrgAdmin` | inline | 26 |
| GET | `/list` | `/backend/invites/list` | `requireAuth`, `requireOrgAdmin` | inline | 132 |
| PATCH | `/:id/resend` | `/backend/invites/:id/resend` | `requireAuth`, `requireOrgAdmin` | inline | 154 |
| PATCH | `/:id/revoke` | `/backend/invites/:id/revoke` | `requireAuth`, `requireOrgAdmin` | inline | 170 |
| POST | `/accept` | `/backend/invites/accept` | — | inline | 181 |

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `default (router)` | default |  | 392 |

## Interfaces

- **Database (Mongoose models used):**
  - `Organization` (server/models/organization.model.ts) — reads: `findById`, `findOne`
  - `Floor` (server/models/floor.model.ts) — reads: `find`
  - `Invite` (server/models/invite.model.ts) — reads: `find`, `findOne`; **writes:** `bulkWrite`
  - `User` (server/models/user.model.ts) — reads: `findOne`, `findById`; **writes:** `create`

## Dependencies

- **Internal:**
  - `server/middleware/auth.ts` — `requireAuth`
  - `server/middleware/roles.ts` — `requireOrgAdmin`
  - `server/services/twoFactorSms.ts` — `storablePhone`
  - `server/models/invite.model.ts` — `Invite`
  - `server/services/otp.ts` — `createOtp`, `verifyOtp`
  - `server/services/mailer.ts` — `sendMail`, `inviteEmailTemplate`, `EMAIL_FROM_NOTIFICATION`, `EMAIL_FROM_RESEND_OTP`, `senderForOrg`
  - `server/models/user.model.ts` — `User`
  - `server/models/organization.model.ts` — `Organization`
  - `server/services/jwt.ts` — `signJwt`
  - `server/models/floor.model.ts` — `Floor`
  - `server/services/init.ts` — `addUserToGarageHQ`
  - `server/services/welcomeEmail.ts` — `sendWelcomeEmail`
  - `server/services/teamforceOnboardingEmail.ts` — `sendTeamforceOnboardingEmail`
  - `server/utils/affiliateId.ts` — `generateAffiliateId`
  - `server/services/channel.ts` — `autoJoinEmployeesChannel`, `autoJoinDefaultChannel`
  - `server/services/officeSubscription.ts` — `canInviteStakeholders`
  - `server/services/downlineTree.ts` — `syncNewEnrollee`
- **Packages:**
  - `express` — `Router`
  - `zod` — `z`
  - `mongoose` — `Types`

## Used by

- `server/app.ts`

Entry: mounted in `server/app.ts` at `/invites`.
