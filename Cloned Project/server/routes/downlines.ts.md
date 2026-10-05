# `server/routes/downlines.ts`

> src/routes/downlines.ts

**Kind:** Express router · **Lines:** 388 · **Mounted at:** `/downlines` (browser: `/backend/downlines`)

<!-- docgen:auto -->

## Purpose
src/routes/downlines.ts

"Enroll a Downline" — any logged-in member can pre-register a NEW user
directly under their referral, into one of the offices they belong to.

Mounted at /downlines. Requires `requireAuth`.

Behavior:
  - Creates a real User row with `referredBy = me._id`.
  - Adds them as a stakeholder of the chosen org with the org's first
    floor (mirrors the addUserToGarageHQ pattern in services/init.ts).
  - Pre-stashes profile fields the inviter supplied (name, phone, city,
    country, designation). `profileComplete` is set when both name and
    phone are filled — the downline skips the onboarding form on first
    login. Otherwise the onboarding card still appears.
  - NO emails, NO links, NO temporary password. The downline logs in […]

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Endpoints (3)

| Method | Router path | Browser path | Middleware | Handler | Line |
|---|---|---|---|---|---|
| GET | `/check-email` | `/backend/downlines/check-email` | `requireAuth` | inline | 73 |
| POST | `/enroll` | `/backend/downlines/enroll` | `requireAuth` | inline | 101 |
| POST | `/:userId/extend-offer` | `/backend/downlines/:userId/extend-offer` | `requireAuth` | `extendDownlineOffer` | 314 |

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `default (router)` | default |  | 387 |

## Interfaces

- **Database (Mongoose models used):**
  - `User` (server/models/user.model.ts) — reads: `findOne`, `findById`; **writes:** `create`
  - `Organization` (server/models/organization.model.ts) — reads: `findById`
  - `Floor` (server/models/floor.model.ts) — reads: `find`
- **Environment via `server/config/env.ts`:** `env.FRONTEND_URL`

## Dependencies

- **Internal:**
  - `server/middleware/auth.ts` — `requireAuth`, `AuthRequest`
  - `server/services/twoFactorSms.ts` — `storablePhone`
  - `server/models/user.model.ts` — `User`
  - `server/models/organization.model.ts` — `Organization`
  - `server/models/floor.model.ts` — `Floor`
  - `server/utils/affiliateId.ts` — `generateAffiliateId`
  - `server/services/downlineTree.ts` — `syncNewEnrollee`
  - `server/services/mailer.ts` — `sendMail`, `EMAIL_FROM_NOTIFICATION`, `senderForOrg`
  - `server/services/channel.ts` — `autoJoinMembersChannel`, `autoJoinDefaultChannel`
  - `server/services/init.ts` — `addUserToGarageHQ`
  - `server/config/env.ts` — `env`
  - `server/controllers/downlineOffer.controller.ts` — `extendDownlineOffer`
- **Packages:**
  - `express` — `Router`, `Request`, `Response`
  - `zod` — `z`, `ZodError`
  - `mongoose` — `Types`

## Used by

- `server/app.ts`

Entry: mounted in `server/app.ts` at `/downlines`.
