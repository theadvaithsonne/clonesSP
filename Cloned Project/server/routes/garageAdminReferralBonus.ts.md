# `server/routes/garageAdminReferralBonus.ts`

> Garage-admin control for the global signup referral bonus.

**Kind:** Express router · **Lines:** 178 · **Mounted at:** `/garage-admin/referral-bonus` (browser: `/backend/garage-admin/referral-bonus`)

<!-- docgen:auto -->

## Purpose
Garage-admin control for the global signup referral bonus.

Every referred signup that completes a profile pays this amount twice — once
to the referrer, once to the new user — straight out of the platform store
wallet. There is no per-payout approval step, so this endpoint is the only
gate. Super-admin only, and every change records who made it.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Endpoints (3)

| Method | Router path | Browser path | Middleware | Handler | Line |
|---|---|---|---|---|---|
| GET | `/` | `/backend/garage-admin/referral-bonus` | — | inline | 27 |
| PUT | `/` | `/backend/garage-admin/referral-bonus` | — | inline | 87 |
| GET | `/payouts` | `/backend/garage-admin/referral-bonus/payouts` | — | inline | 161 |

**Router-level middleware** (`router.use`, runs before route matching):
- `requireGarageAdminAuth, requireGarageSuperAdmin` (L24)

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `default (router)` | default |  | 177 |

## Interfaces

- **Database (Mongoose models used):**
  - `ReferralBonusConfig` (server/models/referralBonusConfig.model.ts) — reads: `findOne`; **writes:** `findOneAndUpdate`
  - `User` (server/models/user.model.ts) — reads: `findOne`
  - `StoreWallet` (server/models/storeWallet.model.ts) — reads: `findOne`
  - `ReferralBonusPayout` (server/models/referralBonusPayout.model.ts) — reads: `countDocuments`, `aggregate`, `find`

## Dependencies

- **Internal:**
  - `server/middleware/garageAdminAuth.ts` — `requireGarageAdminAuth`, `requireGarageSuperAdmin`, `GarageAdminRequest`
  - `server/models/referralBonusConfig.model.ts` — `ReferralBonusConfig`
  - `server/models/referralBonusPayout.model.ts` — `ReferralBonusPayout`
  - `server/models/storeWallet.model.ts` — `StoreWallet`
  - `server/models/user.model.ts` — `User`
  - `server/services/commission.ts` — `PLATFORM_USER_EMAIL`, `PLATFORM_ORG_ID`
- **Packages:**
  - `express` — `Router`, `Response`
  - `zod` — `z`
  - `mongoose` — `Types`

## Used by

- `server/app.ts`

Entry: mounted in `server/app.ts` at `/garage-admin/referral-bonus`.
