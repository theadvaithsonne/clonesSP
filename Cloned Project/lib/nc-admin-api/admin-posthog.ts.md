# `lib/nc-admin-api/admin-posthog.ts`

> Typed client for the NetworkChains admin PostHog session-replay panel: it lists recordings, fetches one recording's details and captured exceptions, gets an embeddable player URL, and loads headline stats, all through contacts-backend's `/admin/posthog/*` proxy.

**Kind:** frontend library · **Lines:** 189

## Purpose
The admin PostHog page lets super admins browse product session replays without their own PostHog login. The PostHog personal API key stays on the server, inside the external NetworkChains contacts-backend, which proxies `/admin/posthog/*`. This file was ported from `networkchains-web-app` `lib/api/admin-posthog.ts` with the same surface; the transport now goes through `./auth` (Garage→NC elevation). It is read-only except for `getEmbed`, which enables sharing on a recording so the panel can iframe PostHog's own player.

## How it works
**Models.** The PostHog shapes are kept loose because their fields vary by PostHog version:
- `PostHogRecording` has id, times, `recording_duration` (seconds), activity counters, console error and warning counts, `start_url`, `person` and `viewed`. `RecordingsPage` wraps a list of them with `has_next`.
- `EmbedInfo` carries `embedUrl` and `accessToken`, plus optional `shareUrl` (a public link) and `posthogUrl` (opens in PostHog, where the Console tab is visible).
- `SessionException` is a `$exception` that the server has already grouped by type and message, with an occurrence count, first and last seen, and URL.
- `PostHogStats` has `events7d`, `weeklyActiveUsers` and `views7d`.

**Error mapping (`get<T>`, private).** It calls `ncAdminFetchRaw`, which throws `NcAdminApiError` (message = `json.error`, plus `detail`) on any non-2xx status.
- If the message is one of `posthog_not_configured`, `posthog_auth` or `posthog_unreachable`, it throws `PostHogUnavailableError`, and the page swaps to a full-panel "unavailable" state.
- Any other error that has a `detail` is re-thrown as `NcAdminApiError("<error>: <detail>")`.
- `posthog_upstream` is deliberately **not** treated as unavailable. It means PostHog answered and rejected the request (for example a bad filter). Treating it as an outage used to blank the panel and hide the real reason.
- On a 2xx response it applies the same checks: an unavailable code becomes `PostHogUnavailableError`, and `ok:false` or a missing `data` becomes `NcAdminApiError(..., 200)` with `detail` appended. Otherwise it returns `data`.

## Exports
- Interfaces: `PostHogPerson`, `PostHogRecording`, `RecordingsPage`, `EmbedInfo`, `SessionException`, `PostHogStats`.
- `class PostHogUnavailableError extends Error { reason }` - PostHog is unusable (not configured, auth failure, unreachable).
- `listRecordings(opts?: { limit?, offset?, search?, apps?: string[], device? }): Promise<RecordingsPage>` - `apps` filters on the `app` super-property (the product switch) and is sent comma-joined. `device` is `"web"` or `"mobile"` and the server maps it to a `$lib` filter; `"all"` is omitted.
- `listSessionExceptions(id): Promise<{ exceptions: SessionException[] }>` - structured exceptions for one session (PostHog does not expose the Console tab over its API).
- `getRecording(id): Promise<PostHogRecording>`.
- `getEmbed(id): Promise<EmbedInfo>` - enables sharing and returns the embed info.
- `getStats(): Promise<PostHogStats>`.

## Interfaces
- **Backend endpoints called** (external NC contacts-backend, `NC_API_URL`):
  - `GET /admin/posthog/recordings?limit&offset&search&apps&device`
  - `GET /admin/posthog/recordings/:id`
  - `GET /admin/posthog/recordings/:id/exceptions`
  - `GET /admin/posthog/recordings/:id/embed` - side effect: enables sharing on that recording in PostHog.
  - `GET /admin/posthog/stats`
- **External services:** NetworkChains contacts-backend, and PostHog behind it.

## Dependencies
- **Internal:** `lib/nc-admin-api/auth.ts` - `ncAdminFetchRaw` and `NcAdminApiError`.
- **Packages:** none.

## Used by
- `app/garage-admin/(admin-dashboard)/networkchains/posthog/page.tsx` - route `/garage-admin/networkchains/posthog`.

## Notes
- `getEmbed` changes state despite being a GET: it makes a recording publicly shareable, and the returned `shareUrl` works without a login.
- The header comment mentions "the admin OTP token" from the NC original. In this port the token comes from silent elevation in `auth.ts`.
