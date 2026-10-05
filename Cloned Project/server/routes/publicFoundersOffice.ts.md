# `server/routes/publicFoundersOffice.ts`

> src/routes/publicFoundersOffice.ts

**Kind:** Express router · **Lines:** 110 · **Mounted at:** `/public/founders-office` (browser: `/backend/public/founders-office`)

<!-- docgen:auto -->

## Purpose
src/routes/publicFoundersOffice.ts

PUBLIC earnings calculator for referring Founders Office ($96/month)
subscriptions. No auth, no user context, no writes.

  GET  /public/founders-office/plan        the split and the volume-bonus tiers
  GET  /public/founders-office/earnings    calculator via query params
  POST /public/founders-office/earnings    calculator via JSON body

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Endpoints (3)

| Method | Router path | Browser path | Middleware | Handler | Line |
|---|---|---|---|---|---|
| GET | `/plan` | `/backend/public/founders-office/plan` | — | inline | 76 |
| GET | `/earnings` | `/backend/public/founders-office/earnings` | — | inline | 90 |
| POST | `/earnings` | `/backend/public/founders-office/earnings` | — | inline | 100 |

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `default (router)` | default |  | 109 |

## Interfaces

None detected: no endpoints, events, data access or environment reads were found.

## Dependencies

- **Internal:**
  - `server/services/unilevelPlusCommission.ts` — `getActiveUnilevelPlusPlan`
  - `server/services/foundersOfficeCalculator.ts` — `calculateFoundersOfficeEarnings`, `FoundersOfficeInput`
- **Packages:**
  - `express` — `Router`, `Request`, `Response`
  - `zod` — `z`

## Used by

- `server/app.ts`

Entry: mounted in `server/app.ts` at `/public/founders-office`.
