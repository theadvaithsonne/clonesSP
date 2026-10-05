# `server/services/teamforceOnboardingEmail.ts`

> Module exporting `sendTeamforceOnboardingEmail`.

**Kind:** backend service · **Lines:** 65

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `sendTeamforceOnboardingEmail` | function | `async sendTeamforceOnboardingEmail(userId: string, orgId: string): Promise<void>` — Fire-and-forget: tells a newly-joined stakeholder to complete their Teamforce onboarding profile. | 29 |

## Interfaces

- **Database (Mongoose models used):**
  - `User` (server/models/user.model.ts) — reads: `findById`
  - `Organization` (server/models/organization.model.ts) — reads: `findById`
- **Environment via `server/config/env.ts`:** `env.FRONTEND_URL`

## Dependencies

- **Internal:**
  - `server/models/user.model.ts` — `User`
  - `server/models/organization.model.ts` — `Organization`
  - `server/services/mailer.ts` — `sendMail`, `EMAIL_FROM_NOTIFICATION`
  - `server/services/bulkEmail.ts` — `emailShell`, `ctaButton`, `greeting`, `bodyText`, `fallbackLink`
  - `server/config/env.ts` — `env`
- **Packages:** none

## Used by

- `server/routes/invites.ts`
