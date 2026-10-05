# `server/services/affiliateAnalytics.ts`

> Module exporting `escapeRx`, `resolveStatsFilters`, `resolveAffiliate`, `listOrganizationCategories` and 5 more.

**Kind:** backend service · **Lines:** 1120

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `AnalyticsRange` | type | Powers the public XAQI analytics endpoints. | 135 |
| `StatsFilters` | interface |  | 137 |
| `DirectReferralStats` | interface | Per-row stats. Legacy field names (totalSalesVolumeCents, salesCount, businessesCount, currency) are preserved unchanged so existing callers of `/affiliate/direct` keep working. | 148 |
| `UnilevelPlusSubscription` | interface | Per-row Unilevel Plus snapshot. | 167 |
| `DirectReferralRow` | interface |  | 177 |
| `GetDirectReferralsResult` | interface |  | 190 |
| `LeaderboardRow` | interface | Mode A row — same shape as the direct row plus `directReferralsCount` so partners can tell at a glance "this user has 12 directs and their combined activity is X". | 201 |
| `GetLeaderboardResult` | interface |  | 205 |
| `IndirectReferralRow` | interface |  | 211 |
| `GetIndirectReferralsResult` | interface |  | 222 |
| `escapeRx` | function | `escapeRx(s: string): string` | 231 |
| `resolveStatsFilters` | function | `async resolveStatsFilters(filters: StatsFilters): Promise<{ paidAfter: Date \| null; orgIdFilter: Ty…` — Convert the user-facing `StatsFilters` into Mongo-ready pieces. | 268 |
| `resolveAffiliate` | function | `async resolveAffiliate(affiliateId: string)` — Resolve a public `affiliateId` handle into the owning User document. | 290 |
| `listOrganizationCategories` | function | `async listOrganizationCategories(): Promise<string[]>` — GET /public/analytics/categories — every category in the admin-managed OrgCategory taxonomy. | 303 |
| `buildSellerStatsMap` | function | `async buildSellerStatsMap(sellerIds: Types.ObjectId[], filters: StatsFilters): Promise<Map<string, DirectReferralStats>>` — For a batch of sellerIds, return per-seller stats sourced from `Invoice` (status: "paid") + `CommissionDistribution` (commissions earned). | 347 |
| `buildParentAggregateStatsMap` | function | `async buildParentAggregateStatsMap(parentIds: Types.ObjectId[], filters: StatsFilters): Promise<{ statsByParent: Map<string, DirectReferr…` — For a batch of PARENT userIds, return per-parent stats aggregated across their level-1 downline's sales activity. | 483 |
| `AnalyticsSort` | type |  | 647 |
| `getDirectReferralsWithStats` | function | `async getDirectReferralsWithStats(params: { parentUserId: string; country?: string; officeId?…): Promise<GetDirectReferralsResult>` | 681 |
| `getLeaderboardReferralsWithStats` | function | `async getLeaderboardReferralsWithStats(params: { country?: string; officeId?: string; category?: s…): Promise<GetLeaderboardResult>` | 771 |
| `getIndirectReferralsWithStats` | function | `async getIndirectReferralsWithStats(params: { parentUserId: string; country?: string; officeId?…): Promise<GetIndirectReferralsResult>` | 972 |

## Interfaces

- **Database (Mongoose models used):**
  - `AffiliateWallet` (server/models/affiliateWallet.model.ts) — reads: `find`
  - `UnilevelPlusPurchase` (server/models/unilevelPlusPurchase.model.ts) — reads: `find`
  - `Organization` (server/models/organization.model.ts) — reads: `find`
  - `User` (server/models/user.model.ts) — reads: `findOne`, `find`, `aggregate`
  - `Invoice` (server/models/invoice.model.ts) — reads: `aggregate`
  - `CommissionDistribution` (server/models/commissionDistribution.model.ts) — reads: `aggregate`

## Dependencies

- **Internal:**
  - `server/models/user.model.ts` — `User`
  - `server/models/commissionDistribution.model.ts` — `CommissionDistribution`
  - `server/models/invoice.model.ts` — `Invoice`
  - `server/models/organization.model.ts` — `Organization`
  - `server/models/affiliateWallet.model.ts` — `AffiliateWallet`
  - `server/models/unilevelPlusPurchase.model.ts` — `UnilevelPlusPurchase`
- **Packages:**
  - `mongoose` — `Types`

## Used by

- `server/routes/publicAnalytics.ts`
- `server/services/affiliateAnalyticsDetail.ts`
