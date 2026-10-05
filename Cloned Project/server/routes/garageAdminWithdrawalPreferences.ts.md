# `server/routes/garageAdminWithdrawalPreferences.ts`

> Express router with 1 endpoint, mounted at `/garage-admin`.

**Kind:** Express router · **Lines:** 182 · **Mounted at:** `/garage-admin` (browser: `/backend/garage-admin`)

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Endpoints (1)

| Method | Router path | Browser path | Middleware | Handler | Line |
|---|---|---|---|---|---|
| GET | `/withdrawal-preferences` | `/backend/garage-admin/withdrawal-preferences` | `requireGarageAdminAuth`, `requireGarageSuperAdmin` | inline | 49 |

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `default (router)` | default |  | 181 |

## Interfaces

- **Database (Mongoose models used):**
  - `User` (server/models/user.model.ts) — reads: `find`
  - `WithdrawalPreference` (server/models/withdrawalPreference.model.ts) — reads: `find`
  - `Organization` (server/models/organization.model.ts) — reads: `find`

## Dependencies

- **Internal:**
  - `server/middleware/garageAdminAuth.ts` — `requireGarageAdminAuth`, `requireGarageSuperAdmin`
  - `server/models/withdrawalPreference.model.ts` — `WithdrawalPreference`
  - `server/models/user.model.ts` — `User`
  - `server/models/organization.model.ts` — `Organization`
  - `server/services/withdrawal.ts` — `getWithdrawableBalanceCents`
  - `server/config/affiliateWithdrawalFees.ts` — `resolveAffiliateFeeTier`, `AFFILIATE_KEEP_THRESHOLD_CENTS`
  - `server/utils/http.ts` — `ok`
- **Packages:**
  - `express` — `Router`, `Request`, `Response`
  - `mongoose` — `Types`
  - `zod` — `z`

## Used by

- `server/app.ts`

Entry: mounted in `server/app.ts` at `/garage-admin`.
