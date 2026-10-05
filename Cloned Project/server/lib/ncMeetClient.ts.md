# `server/lib/ncMeetClient.ts`

> A thin HTTP client for NetworkChains contacts-backend's Garage service API (`/service/garage/meet/*`). The garage-admin "Ignite call" features use it to find hosts and to create, update and check meeting schedules.

**Kind:** backend library · **Lines:** 125

## Purpose
Meetings ("catch-ups" and Ignite calls) live in NetworkChains, an external service that is not part of this repository. Garage admin screens need to look up an admin's NetworkChains account, list or create schedules, add affiliates as attendees, reschedule meetings and show live status. This module wraps those calls behind typed functions. Every call is authenticated with a shared service token and has a hard 8-second timeout. The timeout exists because the admin affiliates list enriches each row through this client, and a stalled NetworkChains should leave that column empty rather than block the whole table.

## How it works
- The base URL is `NC_BACKEND_URL`, defaulting to `https://backend.networkchains.com`. Every request goes to `${NC_BASE}/service/garage/meet${path}`.
- `ncFetch<T>(path, init)` (private):
  - Throws `NcMeetError("GARAGE_SERVICE_TOKEN is not configured", 503)` when the token is empty, without sending a request.
  - Sends `Content-Type: application/json` and `X-Service-Token: <GARAGE_SERVICE_TOKEN>`; any caller headers are merged in after these.
  - Aborts the request after `TIMEOUT_MS = 8000` through an `AbortController`. The timer is cleared in `finally`.
  - Expects a `{ ok, data, error }` envelope. When the response is not 2xx or `ok` is falsy, it throws `NcMeetError(error || "NetworkChains request failed", res.status)`. A body that is not JSON counts as a failure. On success it returns `data`.
- Both `NC_BASE` and `SERVICE_TOKEN` are read once, when the module loads.

## Exports
- `class NcMeetError extends Error` - has `status: number`, the upstream HTTP status or 503 when the token is missing.
- `interface NcHost { userId; orgId; name?; email? }`.
- `interface NcScheduleSummary { scheduleId; roomId; title; scheduledAt; startedAt; durationMinutes; timeZone }`.
- `interface NcScheduleStatus { scheduleId; scheduledAt; startedAt; endedAt; isLive; status: "not_scheduled" | "scheduled" | "started" | "completed" }`.
- `ncHostByEmail(email)` - `GET /host-by-email?email=` → `{ user: NcHost | null }`.
- `ncHostSchedules(ncUserId, days = 60)` - `GET /hosts/:id/schedules?days=` → `{ schedules }`.
- `ncCreateSchedule(ncUserId, { title, scheduledAt, durationMinutes?, timeZone?, description?, attendees? })` - `POST /hosts/:id/schedules` → a summary plus `meetLink`.
- `ncAddAttendee(scheduleId, email, displayName?)` - `POST /schedules/:id/attendees` → `{ added, attendees }`.
- `ncScheduleStatuses(scheduleIds)` - `POST /schedules/status` → `{ statuses: NcScheduleStatus[] }`.
- `ncRescheduleSchedule(scheduleId, { title?, scheduledAt?, durationMinutes?, timeZone?, description? })` - `PATCH /schedules/:id` → `NcScheduleSummary`.
- `ncScheduleRelated(scheduleId)` - `GET /schedules/:id/related` → an untyped record.

## Interfaces
- **External services:** NetworkChains contacts-backend, at `${NC_BACKEND_URL}/service/garage/meet/*`. The token check on that side lives in its `middleware/garageService.ts`, not in this repository.
- **Environment variables:** `NC_BACKEND_URL` - base URL; `GARAGE_SERVICE_TOKEN` - shared secret sent as `X-Service-Token`.

## Dependencies
- **Internal:** none.
- **Packages:** none (uses the global `fetch` and `AbortController`).

## Used by
- `server/routes/garageAdminIgniteCall.ts` (mounted at `/garage-admin`, browser `/backend/garage-admin/...`). It uses host lookup, schedule list and create, add attendee, related data and reschedule. Its `ncErrorResponse` helper maps an `NcMeetError` to HTTP 503 or 502, and a 404 from `ncScheduleRelated` is handled separately.
- `server/routes/garageAdminOneTimeAffiliates.ts` (mounted at `/garage-admin`) - calls `ncScheduleStatuses` in batches to add call status to affiliate rows.
- `server/services/igniteCall.service.ts` - imports only the `NcScheduleStatus` type.

## Notes
- A timeout raises the abort error from `fetch`, not an `NcMeetError`. In `garageAdminIgniteCall.ts`, that ends up in the generic 500 branch rather than 502 or 503.
- `GARAGE_SERVICE_TOKEN` is a credential. Keep it in environment configuration only.
