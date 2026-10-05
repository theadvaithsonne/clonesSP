# `server/routes/comb-plan.ts`

> Express router with 9 endpoints, mounted at `/comb-plans`.

**Kind:** Express router · **Lines:** 470 · **Mounted at:** `/comb-plans` (browser: `/backend/comb-plans`)

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Endpoints (9)

| Method | Router path | Browser path | Middleware | Handler | Line |
|---|---|---|---|---|---|
| POST | `/` | `/backend/comb-plans` | `requireAuth` | inline | 24 |
| GET | `/` | `/backend/comb-plans` | `requireAuth` | inline | 138 |
| GET | `/public/item/:itemType/:itemId` | `/backend/comb-plans/public/item/:itemType/:itemId` | — | inline | 184 |
| GET | `/item/:itemType/:itemId` | `/backend/comb-plans/item/:itemType/:itemId` | `requireAuth` | inline | 218 |
| GET | `/:id` | `/backend/comb-plans/:id` | `requireAuth` | inline | 252 |
| PUT | `/:id` | `/backend/comb-plans/:id` | `requireAuth` | inline | 282 |
| DELETE | `/:id` | `/backend/comb-plans/:id` | `requireAuth` | inline | 359 |
| GET | `/commissions/history` | `/backend/comb-plans/commissions/history` | `requireAuth` | inline | 385 |
| GET | `/commissions/stats/:itemType/:itemId` | `/backend/comb-plans/commissions/stats/:itemType/:itemId` | `requireAuth` | inline | 439 |

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `default (router)` | default |  | 469 |

## Interfaces

None detected: no endpoints, events, data access or environment reads were found.

## Dependencies

- **Internal:**
  - `server/middleware/auth.ts` — `requireAuth`
  - `server/services/commission.ts` — `createCombPlan`, `getCombPlan`, `getCombPlanForItem`, `getCombPlansByOrg`, `updateCombPlan`, `deleteCombPlan`, `getCommissionHistory`, `getItemCommissionStats`
- **Packages:**
  - `express` — `Router`
  - `zod` — `z`

## Used by

- `server/app.ts`

Entry: mounted in `server/app.ts` at `/comb-plans`.
