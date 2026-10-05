# `lib/affiliate-analytics-api.ts`

> Browser-side client for the public affiliate-analytics API (leaderboard, direct and indirect referrals, categories, per-affiliate details), calling a hardcoded host with a hardcoded `x-api-key`.

**Kind:** frontend library · **Lines:** 431

## Purpose
The affiliate leaderboard page shows platform-wide affiliate rankings and a user's own downline network with sales and commission stats. This module holds the TypeScript response types and the fetch helpers for that data. It calls the backend's `/public/analytics/*` endpoints directly (served in this repo by `server/routes/publicAnalytics.ts`, mounted at `/public/analytics`), which are protected by a single shared API key rather than user auth.

## How it works
### Configuration (L4-L5)
- `ANALYTICS_BASE_URL` is hardcoded to `https://test.garage.app`, not `NEXT_PUBLIC_API_URL`. So the page always queries that external deployment, not the backend running in this process.
- `ANALYTICS_API_KEY` is a hardcoded live API key (line 5). It is sent as the `x-api-key` header on every request. The server side checks it in `server/middleware/analyticsKey.ts` against the `ANALYTICS_API_KEY` environment variable (constant-time compare; 401 when missing or wrong, 503 when the server has no key configured).

### Two leaderboard modes
- **Mode A (leaderboard):** `GET /public/analytics/affiliate/direct` with no `affiliateId`. Each row is a platform user whose stats are the summed sales of their direct downline, plus `directReferralsCount`.
- **Mode B (affiliate-downline):** the same endpoint with `affiliateId`. Rows are that affiliate's direct referrals, and each row's stats are that user's own seller activity.
- Indirect referrals (`/affiliate/indirect`) add `level` and `directUplineId`, with optional `level` / `maxDepth` filters.

### Fetch helpers
All helpers build a `URLSearchParams` from optional filters (`officeId`, `country`, `category`, `range` of `1d|7d|30d|90d|all`, `limit`, `offset`), fetch with `cache: "no-store"`, and on a non-2xx response throw `Error(err.error || "API Error: <status>")`.
- Single-page fetches: `fetchLeaderboard`, `fetchDirectReferrals`, `fetchIndirectReferrals`, `fetchCategories` (returns just `data.categories`), `fetchAffiliateDetails`.
- `fetchLeaderboardPage` gets one page (default 200 rows, offset 0): the top results, not everyone.
- `fetchAllLeaderboard`, `fetchAllDirectReferrals`, `fetchAllIndirectReferrals` loop in pages of 200, appending items until `pagination.hasMore` is false and advancing by `pagination.nextOffset` (or offset + 200). Totals come from `data.total`, `directReferralsCount` and `indirectReferralsCount` respectively. `fetchAllDirectReferrals` also returns the `affiliate` header object.
- `fetchAffiliateDetails` calls `/public/analytics/affiliate/:userId/details` with a required `detail` (`transactions|products|customers|businesses`) and `mode`. Its `items` are untyped (`any[]`).

### Types
`AffiliateItemStats` (sales volume and commissions in cents, sales and business counts, unique customers and products), `DirectReferralItem` (user profile fields plus stats and an optional `UnilevelPlusSubscription`), `IndirectReferralItem`, `LeaderboardItem`, `PaginationInfo`, and a client-side `UnifiedLeaderboardRow` that merges all modes and tags each row with `source: "direct" | "indirect" | "leaderboard"`.

## Exports
- Types: `AffiliateInfo`, `AffiliateItemStats`, `UnilevelPlusSubscription`, `DirectReferralItem`, `IndirectReferralItem`, `LeaderboardItem`, `PaginationInfo`, `AnalyticsRange`, `DirectReferralsResponse`, `LeaderboardResponse`, `IndirectReferralsResponse`, `CategoriesResponse`, `UnifiedLeaderboardRow`, `DetailUser`, `AffiliateDetailResponse`.
- `fetchLeaderboard(params): Promise<LeaderboardResponse>` - Mode A, one page.
- `fetchDirectReferrals(params & { affiliateId }): Promise<DirectReferralsResponse>` - Mode B, one page.
- `fetchIndirectReferrals(params & { affiliateId, level?, maxDepth? }): Promise<IndirectReferralsResponse>` - one page of deeper levels.
- `fetchCategories(): Promise<string[]>` - category names for the filter dropdown.
- `fetchLeaderboardPage(params): Promise<{ items; total }>` - first page of Mode A (limit default 200).
- `fetchAllLeaderboard(params): Promise<{ items; total }>` - every Mode A row.
- `fetchAllDirectReferrals(params): Promise<{ items; total; affiliate }>` - every direct referral.
- `fetchAllIndirectReferrals(params): Promise<{ items; total }>` - every indirect referral.
- `fetchAffiliateDetails(params): Promise<AffiliateDetailResponse>` - drill-down for one user.

## Interfaces
- **Backend endpoints called** (on the external host `https://test.garage.app`, not `/backend`; the same routes exist in this repo under `/backend/public/analytics/...`):
  - `GET /public/analytics/affiliate/direct` - leaderboard (no `affiliateId`) or direct downline.
  - `GET /public/analytics/affiliate/indirect` - indirect downline.
  - `GET /public/analytics/categories` - category list.
  - `GET /public/analytics/affiliate/:userId/details` - per-user transactions, products, customers or businesses.
- **External services:** `https://test.garage.app` (hardcoded).

## Dependencies
- **Internal:** none.
- **Packages:** none (uses global `fetch`).

## Used by
- `components/dashboard/AffiliateLeaderboardPage.tsx` - uses `fetchAllDirectReferrals`, `fetchAllIndirectReferrals`, `fetchLeaderboardPage`, `fetchAllLeaderboard`, `fetchCategories`, `fetchAffiliateDetails` and the types.

## Notes
- **Security:** a live API key is hardcoded at line 5 and shipped in the client JavaScript bundle, so anyone can read it and call the public analytics API, which returns users' names, emails, phone numbers and countries. The server-side key is one shared value for all callers (no scopes, no per-caller revocation). Next.js proxy routes also exist (`app/api/affiliate-analytics/direct/route.ts`, `app/api/affiliate-analytics/indirect/route.ts`) that call the backend server-side, but this module does not use them.
- The base URL points at a test deployment rather than following `NEXT_PUBLIC_API_URL`.
- In `fetchAffiliateDetails`, the `?? 50` / `?? 0` defaults sit inside `if (rest.limit)` / `if (rest.offset)` guards, so they never apply; omitted values are simply left off the query.
- The `fetchAll*` loops have no page cap. A backend that keeps reporting `hasMore: true` would loop forever.
