# `lib/affiliate-click.ts`

> Generates stable per-session and per-visitor ids and returns them as a query-string fragment, so the backend can dedupe and count affiliate-link clicks.

**Kind:** frontend library · **Lines:** 45

## Purpose
When someone opens an affiliate invite link (`/<orgSlug>` or `/<orgSlug>/<channelId>`), the landing page calls `GET /backend/affiliate/invite-details`, and the backend records the click server-side in that same request. This module adds client identity to that call: a session id so reloads in one session count as one click, and a visitor id so unique visitors can be counted. No separate tracking beacon is sent, which avoids double counting.

## How it works
- `uuid()` (private) uses `crypto.randomUUID()` when available and falls back to a timestamp plus random base-36 string.
- `persistentId(storage, key)` (private) returns the id already stored under `key`, or creates and stores one. If the write fails (private mode, quota), the new id is still returned for this request.
- `affiliateClickParams()` returns `""` during SSR or if storage access throws. Otherwise it returns `&cs=<sessionId>&cv=<visitorId>`, URL-encoded. The session id comes from sessionStorage `nc_click_sid` and the visitor id from localStorage `nc_click_vid`.
- On the backend (`server/routes/affiliate.ts`, `GET /invite-details`), `cs` and `cv` are optional strings of at most 80 characters. `cs` becomes the click's `sessionId` (falling back to a synthetic id) and `cv` its `visitorId`.

## Exports
- `affiliateClickParams(): string` - `&cs=...&cv=...` fragment to append to the invite-details URL, or `""`.

## Interfaces
- **Backend endpoints called:** none directly; the fragment is appended by callers to `GET /backend/affiliate/invite-details?orgSlug=...&affiliateId=...[&channelId=...]`.
- **Browser storage / cookies:** sessionStorage `nc_click_sid`, localStorage `nc_click_vid`.

## Dependencies
- **Internal:** none.
- **Packages:** none.

## Used by
- `app/(affiliate)/[orgSlug]/page.tsx` - route `/<orgSlug>`.
- `app/(affiliate)/[orgSlug]/[channelId]/page.tsx` - route `/<orgSlug>/<channelId>`.

## Notes
- The fragment starts with `&`, so it must be appended to a URL that already has a query string.
- `persistentId` calls `storage.getItem` outside its own try/catch; a throwing storage is caught by the outer try in `affiliateClickParams`, which then returns `""`.
