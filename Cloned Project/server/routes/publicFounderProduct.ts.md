# `server/routes/publicFounderProduct.ts`

> src/routes/publicFounderProduct.ts

**Kind:** Express router · **Lines:** 183 · **Mounted at:** `/public/founder-products` (browser: `/backend/public/founder-products`)

<!-- docgen:auto -->

## Purpose
src/routes/publicFounderProduct.ts

PUBLIC earnings calculator for founder-set commission on store items. No
auth, no user context, no writes — safe for a marketing page.

Takes the plan SHAPE, not an item id: quoting a real item would reveal what
its founder chose to pay, and the point is letting a prospect model "what
if a founder paid X% on a $Y product".

DEFAULT KIND IS "unilevel_plus": the founder picks the Unilevel Plus comp
plan when creating an item and sets ONE percentage, which is split through
the tree proportionally (see services/founderProductCalculator.ts). The
fixed L1/L2/L3 kind is still reachable with kind=levels for legacy plans.

  GET  /public/founder-products/plan        the two engines and their rules
  GET  /public/founder-products/earnings    calculator via query params […]

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Endpoints (3)

| Method | Router path | Browser path | Middleware | Handler | Line |
|---|---|---|---|---|---|
| GET | `/plan` | `/backend/public/founder-products/plan` | — | inline | 128 |
| GET | `/earnings` | `/backend/public/founder-products/earnings` | — | inline | 163 |
| POST | `/earnings` | `/backend/public/founder-products/earnings` | — | inline | 173 |

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `default (router)` | default |  | 182 |

## Interfaces

None detected: no endpoints, events, data access or environment reads were found.

## Dependencies

- **Internal:**
  - `server/services/unilevelPlusCommission.ts` — `getActiveUnilevelPlusPlan`
  - `server/services/founderProductCalculator.ts` — `calculateFounderProductEarnings`, `COMB_PLAN_MAX_PERCENTAGE`, `UP_MAX_LEVELS`, `FounderCalculatorInput`
- **Packages:**
  - `express` — `Router`, `Request`, `Response`
  - `zod` — `z`

## Used by

- `server/app.ts`

Entry: mounted in `server/app.ts` at `/public/founder-products`.
