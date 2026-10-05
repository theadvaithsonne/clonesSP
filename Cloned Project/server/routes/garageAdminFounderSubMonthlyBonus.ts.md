# `server/routes/garageAdminFounderSubMonthlyBonus.ts`

> Admin surface for the monthly founder Pro-sub volume bonus.

**Kind:** Express router · **Lines:** 179 · **Mounted at:** `/garage-admin/founder-sub-monthly-bonus` (browser: `/backend/garage-admin/founder-sub-monthly-bonus`)

<!-- docgen:auto -->

## Purpose
Admin surface for the monthly founder Pro-sub volume bonus.
Mounted at /garage-admin/founder-sub-monthly-bonus. Mirrors
garageAdminWhitelabelMonthlyBonus.ts endpoints:
  POST /cron              — CRON_WEBHOOK_SECRET-gated backstop
  GET  /runs              — history list, newest first
  GET  /runs/:periodKey   — hydrated detail
  POST /runs/:periodKey/execute — { dryRun? }
  GET  /current           — { accruing, settling }

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Endpoints (5)

| Method | Router path | Browser path | Middleware | Handler | Line |
|---|---|---|---|---|---|
| POST | `/cron` | `/backend/garage-admin/founder-sub-monthly-bonus/cron` | — | inline | 27 |
| GET | `/runs` | `/backend/garage-admin/founder-sub-monthly-bonus/runs` | — | inline | 45 |
| GET | `/current` | `/backend/garage-admin/founder-sub-monthly-bonus/current` | — | inline | 65 |
| GET | `/runs/:periodKey` | `/backend/garage-admin/founder-sub-monthly-bonus/runs/:periodKey` | — | inline | 84 |
| POST | `/runs/:periodKey/execute` | `/backend/garage-admin/founder-sub-monthly-bonus/runs/:periodKey/execute` | — | inline | 157 |

**Router-level middleware** (`router.use`, runs before route matching):
- `requireGarageAdminAuth` (L43)

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `default (router)` | default |  | 178 |

## Interfaces

- **Database (Mongoose models used):**
  - `FounderSubBonusRun` (server/models/founderSubBonusRun.model.ts) — reads: `find`, `findOne`
  - `FounderSubBonusPayout` (server/models/founderSubBonusPayout.model.ts) — reads: `find`, `countDocuments`
  - `User` (server/models/user.model.ts) — reads: `find`
- **Environment variables (`process.env`):** `CRON_WEBHOOK_SECRET`

## Dependencies

- **Internal:**
  - `server/middleware/garageAdminAuth.ts` — `requireGarageAdminAuth`, `GarageAdminRequest`
  - `server/models/founderSubBonusRun.model.ts` — `FounderSubBonusRun`
  - `server/models/founderSubBonusPayout.model.ts` — `FounderSubBonusPayout`
  - `server/models/user.model.ts` — `User`
  - `server/services/founderSubMonthlyBonus/run.ts` — `executeFounderSubMonthlyBonusRun`, `founderSubMonthlyBonusTick`, `payoutsEnabled`, `currentPeriodKeys`
- **Packages:**
  - `express` — `Router`, `Response`

## Used by

- `server/app.ts`

Entry: mounted in `server/app.ts` at `/garage-admin/founder-sub-monthly-bonus`.
