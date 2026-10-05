# `server/routes/garageAdminRankBonus.ts`

> Admin surface for the NetworkChain monthly rank bonus.

**Kind:** Express router · **Lines:** 287 · **Mounted at:** `/garage-admin/rank-bonus` (browser: `/backend/garage-admin/rank-bonus`)

<!-- docgen:auto -->

## Purpose
Admin surface for the NetworkChain monthly rank bonus.

Same gate as /garage-admin/wallets and /garage-admin/auction-settlements —
super-admin only, because the manual trigger can move real money.

The primary use before launch is the dry run: GET a computed run and read the
qualifier list and total bill, then decide whether to set
RANK_BONUS_PAYOUTS_ENABLED=true.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Endpoints (8)

| Method | Router path | Browser path | Middleware | Handler | Line |
|---|---|---|---|---|---|
| POST | `/cron` | `/backend/garage-admin/rank-bonus/cron` | — | inline | 50 |
| GET | `/runs` | `/backend/garage-admin/rank-bonus/runs` | — | inline | 69 |
| GET | `/runs/:periodKey` | `/backend/garage-admin/rank-bonus/runs/:periodKey` | — | inline | 94 |
| POST | `/runs/:periodKey/execute` | `/backend/garage-admin/rank-bonus/runs/:periodKey/execute` | — | inline | 153 |
| GET | `/people` | `/backend/garage-admin/rank-bonus/people` | — | inline | 189 |
| GET | `/people/:userId` | `/backend/garage-admin/rank-bonus/people/:userId` | — | inline | 220 |
| GET | `/plan` | `/backend/garage-admin/rank-bonus/plan` | — | inline | 240 |
| GET | `/current` | `/backend/garage-admin/rank-bonus/current` | — | inline | 257 |

**Router-level middleware** (`router.use`, runs before route matching):
- `requireGarageAdminAuth, requireGarageSuperAdmin` (L66)

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `default (router)` | default |  | 286 |

## Interfaces

- **Database (Mongoose models used):**
  - `RankRun` (server/models/rankRun.model.ts) — reads: `find`, `findOne`
  - `RankQualification` (server/models/rankQualification.model.ts) — reads: `find`, `countDocuments`
  - `User` (server/models/user.model.ts) — reads: `find`
  - `RankPlan` (server/models/rankPlan.model.ts) — reads: `findOne`
- **Environment variables (`process.env`):** `CRON_WEBHOOK_SECRET`

## Dependencies

- **Internal:**
  - `server/middleware/garageAdminAuth.ts` — `requireGarageAdminAuth`, `requireGarageSuperAdmin`, `GarageAdminRequest`
  - `server/models/rankRun.model.ts` — `RankRun`, `periodKeyFor`, `previousPeriodKeyFor`
  - `server/models/rankQualification.model.ts` — `RankQualification`
  - `server/models/rankPlan.model.ts` — `RankPlan`
  - `server/models/user.model.ts` — `User`
  - `server/services/rankBonus/run.ts` — `executeRankBonusRun`, `payoutsEnabled`, `firstEligiblePeriod`
  - `server/services/rankBonus/detail.ts` — `getUserRankDetail`, `listSubscribers`
- **Packages:**
  - `express` — `Router`, `Response`
  - `mongoose` — `Types`

## Used by

- `server/app.ts`

Entry: mounted in `server/app.ts` at `/garage-admin/rank-bonus`.
