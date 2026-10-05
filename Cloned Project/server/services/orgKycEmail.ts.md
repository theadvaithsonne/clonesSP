# `server/services/orgKycEmail.ts`

> The two emails that go out when an admin settles an office's KYC.

**Kind:** backend service · **Lines:** 221

<!-- docgen:auto -->

## Purpose
The two emails that go out when an admin settles an office's KYC.

Without these the verdict is invisible until the founder happens to open
the app again — the in-app nudge only fires on load. A rejection in
particular is a request for work, so it has to leave the building.

── Who gets it ──────────────────────────────────────────────────────────
Every founder of that office (an office can have more than one). Sent from
the office's own verified domain when it has one, so a white-label founder
doesn't get Garage-branded mail about their own company.

── Never throws ─────────────────────────────────────────────────────────
The verdict is already persisted by the time this runs. A Resend outage is
a missing notification, not a failed verification, and the admin's request
must not 500 because of one. Failures are logged and swallowed.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `sendOrgKycVerdictEmail` | function | `async sendOrgKycVerdictEmail(params: { orgId: Types.ObjectId \| string; verdict: "verifie…): Promise<void>` — Fire-and-forget verdict mail. | 163 |

## Interfaces

- **Database (Mongoose models used):**
  - `User` (server/models/user.model.ts) — reads: `find`
  - `Organization` (server/models/organization.model.ts) — reads: `findById`
- **Environment via `server/config/env.ts`:** `env.FRONTEND_URL`

## Dependencies

- **Internal:**
  - `server/config/env.ts` — `env`
  - `server/services/bulkEmail.ts` — `bodyText`, `ctaButton`, `emailShell`, `fallbackLink`, `greeting`
  - `server/services/mailer.ts` — `sendMail`, `senderForOrg`, `EMAIL_FROM_NOTIFICATION`
  - `server/models/organization.model.ts` — `Organization`
  - `server/models/user.model.ts` — `User`
- **Packages:**
  - `mongoose` — `Types`

## Used by

- `server/routes/garageAdminOrgKyc.ts`
