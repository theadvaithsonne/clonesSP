# `lib/nc-admin-api/admin-sentry.ts`

> Read-only typed client and helpers for the NetworkChains admin Sentry error viewer: it lists projects, issues and events through contacts-backend's `/admin/sentry/*` proxy, and provides accessors for walking a Sentry event's `entries[]` and working out who hit an error and on what client.

**Kind:** frontend library · **Lines:** 435

## Purpose
Super admins can browse Sentry issues for the NetworkChains and Garage products inside the Garage admin, without a Sentry login. The Sentry read token stays server-side in the external NetworkChains contacts-backend. This file was ported from `networkchains-web-app` `lib/api/admin-sentry.ts` with the same surface. Only the auth transport changed, to `./auth`'s Garage→NC elevation.

## How it works
**Models (L13-L135).** The Sentry shapes are deliberately loose:
- `SentryProject` has `key`, `label`, `slug` and an optional `product` tag that drives the NetworkChains/Garage switch (treat a missing tag as `"networkchains"`).
- `SentryIssue` and `SentryIssueMetadata`.
- `SentryEvent` has an open index signature and contains `entries[]` (`SentryEntry { type, data }`), `contexts`, `tags`, `user`, `sdk`, `release` and so on.
- Stack data: `SentryExceptionValue` → `SentryStacktrace` → `SentryFrame`, where `context` holds `[lineNo, source]` pairs.
- `SentryBreadcrumb` and `SentryRequestEntry`.

**Entry accessors (L139-L192).** `exceptionValues`, `breadcrumbs`, `requestEntry` and `messageEntry` each find the `entries[]` item of the matching `type` and return its data tolerantly. `replayIdOf` checks `contexts.replay.replay_id` first and then a `replayId`/`replay_id` tag, because SDK versions differ. `issueReplaysUrl` appends `/replays/` to the issue's permalink instead of building the URL from the org slug, which keeps it working across Sentry URL-scheme changes.

**Transport (L208-L256).** `get<T>` calls `ncAdminFetchRaw`. The backend sends "unavailable" reasons (`sentry_not_configured`, `sentry_auth`, `sentry_upstream`, `sentry_unreachable`) as a non-2xx status (503) with the code in `error`. `ncAdminFetchRaw` turns that into an `NcAdminApiError` whose `message` is the code, and `get` remaps it to `SentryUnavailableError(reason)` so the page can render a specific empty state. On a 200 response it applies the same checks to `json.error`, `ok:false` and a missing `data`.

**Endpoints (L258-L301).** See Interfaces.

**Display helpers (L303-L326).** `LEVEL_COLOR` and `levelClass` map a level to Tailwind badge classes. `relTime` formats a timestamp as "Ns/m/h/d ago"; numeric input is treated as epoch seconds.

**Actor resolver (L328-L434).** `resolveActor(event)` returns an `EventActor`:
- Identity: `email`; `userId` (ignored when it looks like an IP); `ip`; and `isGuest` when there is neither an email nor a user id.
- If a `browser` context exists, the event came from the frontend, so the `os`/`client_os` and `device` contexts describe the user's machine and `clientKnown = true`.
- Otherwise the event came from the backend, where the os and device contexts describe the server. The only end-user signal is the request `user-agent` header, which `parseUA` reads with a minimal regex (Edge/Opera/Samsung/Chrome/Firefox/Safari plus Windows/macOS/Android/iOS/Linux). An unparseable UA falls back to its first 80 characters. With no UA, `clientKnown = false` (for example worker, cron or build errors).

## Exports
- Interfaces and types: `SentryProject`, `SentryIssueMetadata`, `SentryIssue`, `SentryFrame`, `SentryStacktrace`, `SentryExceptionValue`, `SentryBreadcrumb`, `SentryRequestEntry`, `SentryEntry`, `SentryEvent`, `IssuesPage`, `EventsPage`, `SentrySort` (`date|new|priority|freq|user|trends`), `SentryStatsPeriod` (`1h|24h|7d|14d|30d|90d`), `IssueListParams`, `EventActor`.
- `class SentryUnavailableError extends Error { reason }`.
- Accessors: `exceptionValues(event)`, `replayIdOf(event | null)`, `issueReplaysUrl(permalink)`, `breadcrumbs(event)`, `requestEntry(event)`, `messageEntry(event)`.
- Endpoints: `listProjects()`, `listIssues(params: IssueListParams)`, `getIssue(id)`, `getLatestEvent(id)`, `listEvents(id, cursor?)`, `getEvent(id, eventId)`.
- Display: `LEVEL_COLOR`, `levelClass(level?)`, `relTime(iso?)`, `resolveActor(event): EventActor`.

## Interfaces
- **Backend endpoints called** (external NC contacts-backend, `NC_API_URL`, all GET):
  - `/admin/sentry/projects`
  - `/admin/sentry/issues?project&query&sort&statsPeriod&cursor`
  - `/admin/sentry/issues/:id`
  - `/admin/sentry/issues/:id/events/latest`
  - `/admin/sentry/issues/:id/events?cursor=`
  - `/admin/sentry/issues/:id/events/:eventId`
- **External services:** NetworkChains contacts-backend, and the Sentry API behind it.

## Dependencies
- **Internal:** `lib/nc-admin-api/auth.ts` - `ncAdminFetchRaw` and `NcAdminApiError`.
- **Packages:** none.

## Used by
- `app/garage-admin/(admin-dashboard)/networkchains/sentry/page.tsx` - route `/garage-admin/networkchains/sentry`, the issue list.
- `app/garage-admin/(admin-dashboard)/networkchains/sentry/[issueId]/page.tsx` - route `/garage-admin/networkchains/sentry/:issueId`, the issue detail.
- `components/nc-admin/sentry/event-panels.tsx`, `components/nc-admin/sentry/stack-trace.tsx` - event renderers.

## Notes
- The error mapping depends on `NcAdminApiError.message` equalling the backend's `error` code exactly. Changing how `auth.ts` builds error messages would break the unavailable-state detection.
- Events can include request headers, cookies and user IPs (PII), which is only appropriate for super-admin views.
