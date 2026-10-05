# `server/routes/rankBonus.ts`

> User-facing view of the NetworkChain rank bonus.

**Kind:** Express router · **Lines:** 137 · **Mounted at:** `/rank-bonus` (browser: `/backend/rank-bonus`)

<!-- docgen:auto -->

## Purpose
User-facing view of the NetworkChain rank bonus.

Strictly self-service: every handler derives the subject from the JWT, so
there is no way to read another member's tree from here. The admin surface
(routes/garageAdminRankBonus.ts) is the only place an arbitrary userId can be
queried, and it is super-admin gated.

Read-only. Nothing here triggers a run or moves money.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Endpoints (3)

| Method | Router path | Browser path | Middleware | Handler | Line |
|---|---|---|---|---|---|
| GET | `/me` | `/backend/rank-bonus/me` | — | inline | 29 |
| GET | `/plan` | `/backend/rank-bonus/plan` | — | inline | 76 |
| GET | `/me/history` | `/backend/rank-bonus/me/history` | — | inline | 100 |

**Router-level middleware** (`router.use`, runs before route matching):
- `requireAuth` (L19)

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `default (router)` | default |  | 136 |

## Interfaces

- **Database (Mongoose models used):**
  - `RankPlan` (server/models/rankPlan.model.ts) — reads: `findOne`
  - `RankQualification` (server/models/rankQualification.model.ts) — reads: `find`
  - `RankRun` (server/models/rankRun.model.ts) — reads: `find`

## Dependencies

- **Internal:**
  - `server/middleware/auth.ts` — `requireAuth`
  - `server/models/rankPlan.model.ts` — `RankPlan`
  - `server/models/rankQualification.model.ts` — `RankQualification`
  - `server/models/rankRun.model.ts` — `RankRun`, `periodKeyFor`
  - `server/services/rankBonus/detail.ts` — `getUserRankDetail`
- **Packages:**
  - `express` — `Router`, `Response`

## Used by

- `server/app.ts`

Entry: mounted in `server/app.ts` at `/rank-bonus`.
