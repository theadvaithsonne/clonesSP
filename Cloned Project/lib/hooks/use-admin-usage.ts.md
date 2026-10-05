# `lib/hooks/use-admin-usage.ts`

> React Query hooks that load AI-usage cost rollups (per user, per-user drill-down and platform summary) from the external NetworkChains admin API for the garage-admin AI-cost page.

**Kind:** frontend library · **Lines:** 60

## Purpose
The ported NetworkChains "AI cost" admin page (`/garage-admin/networkchains/ai-cost`) shows how much AI usage each user and the platform as a whole generated over a date range. The data lives on contacts-backend (`NEXT_PUBLIC_NC_API_URL`), not on this project's backend. These hooks wrap the fetchers in `lib/nc-admin-api/admin.ts` with caching and sensible enable/retry rules.

## How it works
- `retry(failureCount, error)` - never retries an `AdminUnauthorizedError` (expired NC admin session), so the page can react immediately; other errors retry up to 2 times.
- `hasToken()` - true when `getNcAdminToken()` finds an NC admin token in localStorage. It is the default for each hook's `tokenPresent` parameter, evaluated on every render; the page can pass its own value instead.
- Each hook is enabled only when a token is present and `from`/`to` (and, for the drill-down, `userId`) are set. Query keys include the date range so changing it fetches fresh data.

## Exports
- `useUsageUsers(from: string, to: string, tokenPresent = hasToken())` - per-user cost rollup; key `["admin","usage","users",from,to]`; calls `getUsageUsers` (`GET /admin/usage/users?...`).
- `useUsageUser(userId: string | null, from, to, tokenPresent = hasToken())` - single-user drill-down, disabled until `userId` is set; calls `getUsageUser` (`GET /admin/usage/users/:userId?...`).
- `useUsageSummary(from: string, to: string, tokenPresent = hasToken())` - platform-wide summary strip; calls `getUsageSummary` (`GET /admin/usage/summary?...`).

## Interfaces
- **External services:** NetworkChains contacts-backend admin usage endpoints (above), via `ncAdminFetch`.
- **Browser storage / cookies:** reads localStorage `nc_admin_token` through `getNcAdminToken()`.

## Dependencies
- **Internal:** `lib/nc-admin-api/admin.ts` - fetchers, response types, `AdminUnauthorizedError`; `lib/nc-admin-api/auth.ts` - `getNcAdminToken`.
- **Packages:** `@tanstack/react-query` - `useQuery`.

## Used by
- `app/garage-admin/(admin-dashboard)/networkchains/ai-cost/page.tsx`

## Notes
- The `retry` comment mentions dropping back to an "OTP gate"; the auth module now elevates silently from the Garage session, so that wording is a leftover. Unlike `use-admin-funnels.ts`, these hooks do not re-elevate themselves; the page decides what to do on a 401.
