# `server/routes/publicRankBonus.ts`

> src/routes/publicRankBonus.ts

**Kind:** Express router · **Lines:** 173 · **Mounted at:** `/public/rank-bonus` (browser: `/backend/public/rank-bonus`)

<!-- docgen:auto -->

## Purpose
src/routes/publicRankBonus.ts

PUBLIC NetworkChain rank-bonus calculator. No auth, no user context, no
writes — it reads the live RankPlan and runs a pure projection.

Like the Unilevel Plus calculator it takes a HYPOTHETICAL org shape rather
than a userId: quoting a real member's leg structure would leak their
network to anyone who could guess an id.

  GET  /public/rank-bonus/plan       the ladder and the rules
  GET  /public/rank-bonus/earnings   calculator via query params
  POST /public/rank-bonus/earnings   calculator via JSON body

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Endpoints (3)

| Method | Router path | Browser path | Middleware | Handler | Line |
|---|---|---|---|---|---|
| GET | `/plan` | `/backend/public/rank-bonus/plan` | — | inline | 123 |
| GET | `/earnings` | `/backend/public/rank-bonus/earnings` | — | inline | 153 |
| POST | `/earnings` | `/backend/public/rank-bonus/earnings` | — | inline | 163 |

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `default (router)` | default |  | 172 |

## Interfaces

- **Database (Mongoose models used):**
  - `RankPlan` (server/models/rankPlan.model.ts) — reads: `findOne`
  - `ThirdPartyClient` (server/models/thirdPartyClient.model.ts) — reads: `findById`

## Dependencies

- **Internal:**
  - `server/models/rankPlan.model.ts` — `RankPlan`, `RANK_KEYS`
  - `server/models/thirdPartyClient.model.ts` — `ThirdPartyClient`
  - `server/services/rankBonusCalculator.ts` — `calculateRankBonus`, `RankCalculatorInput`
- **Packages:**
  - `express` — `Router`, `Request`, `Response`
  - `zod` — `z`

## Used by

- `server/app.ts`

Entry: mounted in `server/app.ts` at `/public/rank-bonus`.
