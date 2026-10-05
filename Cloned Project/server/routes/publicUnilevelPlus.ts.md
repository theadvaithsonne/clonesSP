# `server/routes/publicUnilevelPlus.ts`

> src/routes/publicUnilevelPlus.ts

**Kind:** Express router · **Lines:** 128 · **Mounted at:** `/public/unilevel-plus` (browser: `/backend/public/unilevel-plus`)

<!-- docgen:auto -->

## Purpose
src/routes/publicUnilevelPlus.ts

PUBLIC Unilevel Plus earnings calculator. No auth, no user context, no
writes — it reads the live plan config and runs a pure projection, so it is
safe to call from a marketing page or an affiliate's own site.

Deliberately takes a HYPOTHETICAL org shape rather than a userId: quoting a
real person's downline would leak their network size to anyone who could
guess an id, and the whole point is letting a prospect model "what if".

  GET  /public/unilevel-plus/plan         the pool structure and the rules
  GET  /public/unilevel-plus/earnings     calculator via query params
  POST /public/unilevel-plus/earnings     calculator via JSON body

Inputs are clamped rather than rejected wherever a silly number would only
produce a silly answer — a public endpoint should not be a way to make the […]

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Endpoints (3)

| Method | Router path | Browser path | Middleware | Handler | Line |
|---|---|---|---|---|---|
| GET | `/plan` | `/backend/public/unilevel-plus/plan` | — | inline | 92 |
| GET | `/earnings` | `/backend/public/unilevel-plus/earnings` | — | inline | 108 |
| POST | `/earnings` | `/backend/public/unilevel-plus/earnings` | — | inline | 118 |

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `default (router)` | default |  | 127 |

## Interfaces

None detected: no endpoints, events, data access or environment reads were found.

## Dependencies

- **Internal:**
  - `server/services/unilevelPlusCommission.ts` — `getActiveUnilevelPlusPlan`
  - `server/services/unilevelPlusCalculator.ts` — `calculateUnilevelPlusEarnings`, `CalculatorInput`
- **Packages:**
  - `express` — `Router`, `Request`, `Response`
  - `zod` — `z`

## Used by

- `server/app.ts`

Entry: mounted in `server/app.ts` at `/public/unilevel-plus`.
