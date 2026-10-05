# `server/routes/publicBond.ts`

> Public bond page — no login.

**Kind:** Express router · **Lines:** 114 · **Mounted at:** `/public/bonds` (browser: `/backend/public/bonds`)

<!-- docgen:auto -->

## Purpose
Public bond page — no login.

  GET /public/bonds/:bondHash

Anyone with a bond's hash can see its value, interest paid, remaining
payments and payout log — the "look up any bond" experience. What is
deliberately NOT exposed is listed on buildPublicBondView.

Bonds can only be issued by crypto-office founders, so every bond
reachable here is a crypto-office bond by construction.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Endpoints (1)

| Method | Router path | Browser path | Middleware | Handler | Line |
|---|---|---|---|---|---|
| GET | `/:bondHash` | `/backend/public/bonds/:bondHash` | `rateLimit` | inline | 66 |

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `default (router)` | default |  | 113 |

## Interfaces

- **Database (Mongoose models used):**
  - `BondHolding` (server/models/bondHolding.model.ts) — reads: `findOne`
- **Timers / queues:** `setInterval` at L61

## Dependencies

- **Internal:**
  - `server/models/bondHolding.model.ts` — `BondHolding`
  - `server/services/bondHash.ts` — `normalizeBondHash`
  - `server/services/bondView.ts` — `buildPublicBondView`, `loadViewSources`
- **Packages:**
  - `express` — `Router`, `Request`, `Response`, `NextFunction`

## Used by

- `server/app.ts`

Entry: mounted in `server/app.ts` at `/public/bonds`.
