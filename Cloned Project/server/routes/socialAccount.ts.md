# `server/routes/socialAccount.ts`

> src/routes/socialAccount.ts Social media account management — affiliates connect & verify their social accounts.

**Kind:** Express router · **Lines:** 291 · **Mounted at:** `/social-accounts` (browser: `/backend/social-accounts`)

<!-- docgen:auto -->

## Purpose
src/routes/socialAccount.ts
Social media account management — affiliates connect & verify their social accounts.

POST   /social-accounts/connect        → Add a social account (generates verification code)
POST   /social-accounts/:id/verify     → Trigger bio-code verification
GET    /social-accounts                → List user's connected accounts
DELETE /social-accounts/:id            → Remove a connected account

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Endpoints (5)

| Method | Router path | Browser path | Middleware | Handler | Line |
|---|---|---|---|---|---|
| POST | `/connect` | `/backend/social-accounts/connect` | `requireAuth` | inline | 34 |
| POST | `/:id/verify` | `/backend/social-accounts/:id/verify` | `requireAuth` | inline | 146 |
| POST | `/:id/manual-verify` | `/backend/social-accounts/:id/manual-verify` | `requireAuth` | inline | 220 |
| GET | `/` | `/backend/social-accounts` | `requireAuth` | inline | 231 |
| DELETE | `/:id` | `/backend/social-accounts/:id` | `requireAuth` | inline | 265 |

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `default (router)` | default |  | 290 |

## Interfaces

- **Database (Mongoose models used):**
  - `SocialAccount` (server/models/socialAccount.model.ts) — reads: `findOne`, `find`; **writes:** `create`, `findOneAndDelete`

## Dependencies

- **Internal:**
  - `server/middleware/auth.ts` — `requireAuth`
  - `server/models/socialAccount.model.ts` — `SocialAccount`
  - `server/models/contentCampaign.model.ts` — `SOCIAL_PLATFORMS`
  - `server/services/viewTracking.ts` — `extractUsername`, `generateVerificationCode`, `verifyBioCode`
- **Packages:**
  - `express` — `Router`, `Request`, `Response`
  - `zod` — `z`
  - `mongoose` — `Types`

## Used by

- `server/app.ts`

Entry: mounted in `server/app.ts` at `/social-accounts`.
