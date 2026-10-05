# `server/routes/publicWhiteLabel.ts`

> src/routes/publicWhiteLabel.ts

**Kind:** Express router · **Lines:** 110 · **Mounted at:** `/public/white-label` (browser: `/backend/public/white-label`)

<!-- docgen:auto -->

## Purpose
src/routes/publicWhiteLabel.ts

PUBLIC earnings calculator for referring White Label ($600/year)
subscriptions. No auth, no user context, no writes.

  GET  /public/white-label/plan        the split and the volume-bonus tiers
  GET  /public/white-label/earnings    calculator via query params
  POST /public/white-label/earnings    calculator via JSON body

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Endpoints (3)

| Method | Router path | Browser path | Middleware | Handler | Line |
|---|---|---|---|---|---|
| GET | `/plan` | `/backend/public/white-label/plan` | — | inline | 76 |
| GET | `/earnings` | `/backend/public/white-label/earnings` | — | inline | 90 |
| POST | `/earnings` | `/backend/public/white-label/earnings` | — | inline | 100 |

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `default (router)` | default |  | 109 |

## Interfaces

None detected: no endpoints, events, data access or environment reads were found.

## Dependencies

- **Internal:**
  - `server/services/unilevelPlusCommission.ts` — `getActiveUnilevelPlusPlan`
  - `server/services/whiteLabelCalculator.ts` — `calculateWhiteLabelEarnings`, `WhiteLabelInput`
- **Packages:**
  - `express` — `Router`, `Request`, `Response`
  - `zod` — `z`

## Used by

- `server/app.ts`

Entry: mounted in `server/app.ts` at `/public/white-label`.
