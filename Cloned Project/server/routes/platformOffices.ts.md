# `server/routes/platformOffices.ts`

> src/routes/platformOffices.ts

**Kind:** Express router · **Lines:** 375 · **Mounted at:** `/platform` (browser: `/backend/platform`)

<!-- docgen:auto -->

## Purpose
src/routes/platformOffices.ts

The 30-day office grace programme, for integrating platforms.

Normally an office needs an active $25 Unilevel Plus licence
(services/officeEligibility.ts). These endpoints let a platform create a
STARTER office for a founder who has none, and give them 30 days to buy it,
with a countdown and the live combo pricing to buy from.

AUTH: every route takes BOTH
  Authorization: Bearer <user JWT>   — who the office is for
  X-Garage-Platform: <key>           — which platform is vouching
The platform key must hold the `offices:grace` scope. The main web and
mobile apps never send one, so their licence gate is untouched; nothing
about GARAGE HQ or any office created elsewhere changes.
 […]

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Endpoints (6)

| Method | Router path | Browser path | Middleware | Handler | Line |
|---|---|---|---|---|---|
| GET | `/offices/eligibility` | `/backend/platform/offices/eligibility` | — | inline | 94 |
| POST | `/offices` | `/backend/platform/offices` | `async (req: Request, res: Response, next) => …` | `createFirstTimeOfficeHandler` | 114 |
| GET | `/offices/:orgId/status` | `/backend/platform/offices/:orgId/status` | — | inline | 162 |
| GET | `/offices` | `/backend/platform/offices` | — | inline | 206 |
| GET | `/offer` | `/backend/platform/offer` | — | inline | 243 |
| POST | `/offer/checkout` | `/backend/platform/offer/checkout` | — | inline | 299 |

**Router-level middleware** (`router.use`, runs before route matching):
- `requireAuth, requirePlatformKey` (L46)

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `default (router)` | default |  | 374 |

## Interfaces

- **Database (Mongoose models used):**
  - `ThirdPartyClient` (server/models/thirdPartyClient.model.ts) — reads: `findOne`
  - `MagicLink` (server/models/magicLink.model.ts) — reads: `findOne`; **writes:** `create`
  - `Organization` (server/models/organization.model.ts) — reads: `findById`, `find`
  - `User` (server/models/user.model.ts) — reads: `findById`
- **Environment via `server/config/env.ts`:** `env.FRONTEND_URL`

## Dependencies

- **Internal:**
  - `server/middleware/auth.ts` — `requireAuth`
  - `server/middleware/platformKey.ts` — `requirePlatformKey`, `PlatformRequest`
  - `server/routes/org.ts` — `createFirstTimeOfficeHandler`
  - `server/services/officeGrace.ts` — `checkGraceEligibility`, `graceStatusFor`, `newGraceWindow`, `OFFICE_GRACE_DAYS`
  - `server/models/organization.model.ts` — `Organization`
  - `server/models/user.model.ts` — `User`
  - `server/models/thirdPartyClient.model.ts` — `ThirdPartyClient`
  - `server/models/magicLink.model.ts` — `MagicLink`, `generateMagicLinkToken`
  - `server/services/comboWindow.ts` — `comboWindowFor`
  - `server/services/comboCheckout.ts` — `quoteAllPlans`
  - `server/services/unilevelPlusCommission.ts` — `getUserPurchase`
  - `server/config/env.ts` — `env`
- **Packages:**
  - `express` — `Router`, `Request`, `Response`
  - `zod` — `z`
  - `mongoose` — `Types`

## Used by

- `server/app.ts`

Entry: mounted in `server/app.ts` at `/platform`.
