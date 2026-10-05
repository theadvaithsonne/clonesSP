# `lib/content-analytics-api.ts`

> Typed client helpers for the content-engagement analytics dashboard: an org-wide overview and a per-content-type leaderboard.

**Kind:** frontend library · **Lines:** 68

## Purpose
Public content pages (videos, drops, articles, recordings, testimonials) report viewer engagement through `lib/content-tracker.ts`. This file is the read side: it fetches the aggregated numbers that the Content Analytics page shows to org members, so the component does not build query strings or response types itself.

## How it works
Both functions build a query string only from the options actually supplied and call the shared `api()` wrapper from `lib/api.ts` with the session token from `getToken()` (sent as `Authorization: Bearer ...`). `api()` throws an `Error` carrying the server's `error`/`message` on any non-2xx response.

- `fetchOverview(from?, to?, myPostsOnly?)` -> `GET /backend/content-engagement/overview`. Returns per-type totals (`byType`), top affiliates who drove sessions, and top content items for the caller's current org.
- `fetchLeaderboard(contentType, opts?)` -> `GET /backend/content-engagement/leaderboard/:contentType`. Returns ranked items for one content type, an `aggregated` block for that type, and the affiliates who drove the most sessions.

Server-side behaviour (`server/routes/contentEngagement.ts`): both routes require auth and scope results to the caller's `orgId` from the token. `from`/`to` are validated as ISO datetime strings and filter on session start. `myPostsOnly=true` restricts to content authored by the caller. The leaderboard rejects content types outside `video | drop | article | recording | testimonial` with 400, defaults `limit` to 50 (max 100), and accepts `sortBy` of `totalSessions | totalWatchTime | avgCompletion | uniqueViewers` (default `totalSessions`).

## Exports
- `fetchOverview(from?: string, to?: string, myPostsOnly?: boolean): Promise<OverviewData>` - org overview across all content types.
- `fetchLeaderboard(contentType: string, opts?: { from?; to?; limit?; sortBy?; myPostsOnly? }): Promise<LeaderboardData>` - ranked items for one content type.
- `ContentTypeStats` - per-type totals (sessions, unique viewers, watch/read time, average completion, completed count, affiliate-driven sessions).
- `TopAffiliate` - affiliate with session count, content types touched and average completion.
- `TopContentItem` - one content item's aggregate stats in the overview.
- `OverviewData` - `{ success, byType, topAffiliates, topContent }`.
- `LeaderboardItem` - one ranked item, including averages, `affiliatePercent`, `topDevice` and `lastActivity`.
- `LeaderboardAffiliate` - affiliate stats within a leaderboard.
- `LeaderboardData` - `{ success, contentType, items, aggregated, topAffiliates }`.

## Interfaces
- **Backend endpoints called:** `GET /backend/content-engagement/overview?from&to&myPostsOnly` - org overview; `GET /backend/content-engagement/leaderboard/:contentType?from&to&limit&sortBy&myPostsOnly` - per-type ranking.
- **Browser storage / cookies:** reads the session token from localStorage via `getToken()`.

## Dependencies
- **Internal:** `lib/api.ts` - `api()` fetch wrapper and base URL; `lib/auth.ts` - `getToken()`.

## Used by
`components/dashboard/ContentAnalyticsPage.tsx`.

## Notes
- `getToken()!` is non-null asserted; with no session the request goes out unauthenticated and the backend's `requireAuth` rejects it, surfacing as a thrown error.
- Pass `from`/`to` as full ISO datetimes (e.g. `toISOString()`); a bare `YYYY-MM-DD` fails the server's zod `datetime()` check.
