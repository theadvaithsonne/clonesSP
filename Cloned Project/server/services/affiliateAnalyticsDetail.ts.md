# `server/services/affiliateAnalyticsDetail.ts`

> src/services/affiliateAnalyticsDetail.ts

**Kind:** backend service · **Lines:** 643

<!-- docgen:auto -->

## Purpose
src/services/affiliateAnalyticsDetail.ts

Drill-down companion to affiliateAnalytics.ts. Given a userId + a `mode`
(matching one of the two semantics on /affiliate/direct), returns the
actual rows behind any one of the four counts a leaderboard row exposes:

  transactions  ← stats.salesCount       (paid invoices)
  products      ← stats.uniqueProducts   (distinct {itemType, itemId})
  customers     ← stats.uniqueCustomers  (distinct invoice.userId)
  businesses    ← stats.businessesCount  (distinct invoice.organizationId)

Reconciliation guarantee: the `total` returned for each detail equals the
matching count in `stats` for the same user/filters. We achieve that by
reusing `buildSellerStatsMap` / `buildParentAggregateStatsMap` from the
canonical stats service for the response's `stats` field, and by applying
the *same* invoice $match clause those helpers build internally.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `DetailKind` | type |  | 43 |
| `DrillDownMode` | type |  | 49 |
| `GetRowDetailsParams` | interface |  | 51 |
| `RowUserInfo` | interface |  | 60 |
| `RowDetailsResponse` | interface |  | 70 |
| `resolveSellerIdsForRow` | function | `async resolveSellerIdsForRow(userId: Types.ObjectId, mode: DrillDownMode): Promise<Types.ObjectId[]>` | 105 |
| `getRowDetails` | function | `async getRowDetails(params: GetRowDetailsParams): Promise<RowDetailsResponse>` | 146 |
| `AnalyticsRange` | export |  | 642 |

## Interfaces

- **Database (Mongoose models used):**
  - `User` (server/models/user.model.ts) — reads: `find`, `findById`
  - `Invoice` (server/models/invoice.model.ts) — reads: `countDocuments`, `find`, `aggregate`, `distinct`
  - `Organization` (server/models/organization.model.ts) — reads: `find`

## Dependencies

- **Internal:**
  - `server/services/affiliateAnalytics.ts` — `AnalyticsRange`, `DirectReferralStats`, `StatsFilters`, `buildParentAggregateStatsMap`, `buildSellerStatsMap`, `resolveStatsFilters`
  - `server/models/invoice.model.ts` — `Invoice`
  - `server/utils/invoiceMoney.ts` — `usdMinorExpr`, `usdRates`
  - `server/models/user.model.ts` — `User`
  - `server/models/organization.model.ts` — `Organization`
  - `server/models/product.model.ts` — `Product`
  - `server/models/course.model.ts` — `Course`
  - `server/models/channel.model.ts` — `Channel`
  - `server/models/workshop.model.ts` — `Workshop`
  - `server/models/service.model.ts` — `Service`
  - `server/models/callOffering.model.ts` — `CallOffering`
  - `server/models/officePlan.model.ts` — `OfficePlan`
- **Packages:**
  - `mongoose` — `Types`

## Used by

- `server/routes/publicAnalytics.ts`
