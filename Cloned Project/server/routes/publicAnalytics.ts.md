# `server/routes/publicAnalytics.ts`

> Express router with 4 endpoints, mounted at `/public/analytics`.

**Kind:** Express router · **Lines:** 422 · **Mounted at:** `/public/analytics` (browser: `/backend/public/analytics`)

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Endpoints (4)

| Method | Router path | Browser path | Middleware | Handler | Line |
|---|---|---|---|---|---|
| GET | `/affiliate/direct` | `/backend/public/analytics/affiliate/direct` | — | inline | 88 |
| GET | `/categories` | `/backend/public/analytics/categories` | — | inline | 197 |
| GET | `/affiliate/indirect` | `/backend/public/analytics/affiliate/indirect` | — | inline | 245 |
| GET | `/affiliate/:userId/details` | `/backend/public/analytics/affiliate/:userId/details` | — | inline | 372 |

**Router-level middleware** (`router.use`, runs before route matching):
- `requireAnalyticsKey` (L38)

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `default (router)` | default |  | 421 |

## Interfaces

None detected: no endpoints, events, data access or environment reads were found.

## Dependencies

- **Internal:**
  - `server/middleware/analyticsKey.ts` — `requireAnalyticsKey`
  - `server/utils/http.ts` — `ok`, `fail`
  - `server/services/affiliateAnalytics.ts` — `resolveAffiliate`, `getDirectReferralsWithStats`, `getLeaderboardReferralsWithStats`, `getIndirectReferralsWithStats`, `listOrganizationCategories`, `AnalyticsRange`
  - `server/services/affiliateAnalyticsDetail.ts` — `getRowDetails`
- **Packages:**
  - `express` — `Router`
  - `zod` — `z`
  - `mongoose` — `Types`

## Used by

- `server/app.ts`

Entry: mounted in `server/app.ts` at `/public/analytics`.
