# `server/routes/garageAdminCryptosubMonthlyBonus.ts`

> Admin surface for the monthly cryptosub volume bonus.

**Kind:** Express router · **Lines:** 201 · **Mounted at:** `/garage-admin/cryptosub-monthly-bonus` (browser: `/backend/garage-admin/cryptosub-monthly-bonus`)

<!-- docgen:auto -->

## Purpose
Admin surface for the monthly cryptosub volume bonus.
Mounted at /garage-admin/cryptosub-monthly-bonus. Mirrors the
rank-bonus admin routes for consistency:
  POST /cron              — CRON_WEBHOOK_SECRET-gated backstop
  GET  /runs              — history list, newest first
  GET  /runs/:periodKey   — hydrated detail (payouts + user names)
  POST /runs/:periodKey/execute — { dryRun? } — refuses paid periods
  GET  /current           — { accruing, settling } this month + last

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Endpoints (5)

| Method | Router path | Browser path | Middleware | Handler | Line |
|---|---|---|---|---|---|
| POST | `/cron` | `/backend/garage-admin/cryptosub-monthly-bonus/cron` | — | inline | 36 |
| GET | `/runs` | `/backend/garage-admin/cryptosub-monthly-bonus/runs` | — | inline | 56 |
| GET | `/current` | `/backend/garage-admin/cryptosub-monthly-bonus/current` | — | inline | 77 |
| GET | `/runs/:periodKey` | `/backend/garage-admin/cryptosub-monthly-bonus/runs/:periodKey` | — | inline | 103 |
| POST | `/runs/:periodKey/execute` | `/backend/garage-admin/cryptosub-monthly-bonus/runs/:periodKey/execute` | — | inline | 179 |

**Router-level middleware** (`router.use`, runs before route matching):
- `requireGarageAdminAuth` (L53)

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `default (router)` | default |  | 200 |

## Interfaces

- **Database (Mongoose models used):**
  - `CryptosubBonusRun` (server/models/cryptosubBonusRun.model.ts) — reads: `find`, `findOne`
  - `CryptosubBonusPayout` (server/models/cryptosubBonusPayout.model.ts) — reads: `find`, `countDocuments`
  - `User` (server/models/user.model.ts) — reads: `find`
- **Environment variables (`process.env`):** `CRON_WEBHOOK_SECRET`

## Dependencies

- **Internal:**
  - `server/middleware/garageAdminAuth.ts` — `requireGarageAdminAuth`, `GarageAdminRequest`
  - `server/models/cryptosubBonusRun.model.ts` — `CryptosubBonusRun`
  - `server/models/cryptosubBonusPayout.model.ts` — `CryptosubBonusPayout`
  - `server/models/user.model.ts` — `User`
  - `server/services/cryptosubMonthlyBonus/run.ts` — `executeCryptosubMonthlyBonusRun`, `cryptosubMonthlyBonusTick`, `payoutsEnabled`, `currentPeriodKeys`
- **Packages:**
  - `express` — `Router`, `Response`
  - `mongoose` — `Types`

## Used by

- `server/app.ts`

Entry: mounted in `server/app.ts` at `/garage-admin/cryptosub-monthly-bonus`.
