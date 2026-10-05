# `lib/admin-api/ignite-call.ts`

> Garage-admin client for "Ignite calls": links between an affiliate and a NetworkChains catch-up meeting hosted by an admin. Covers picking, attaching, rescheduling, completing, listing and reading related session data.

**Kind:** frontend library · **Lines:** 206

## Purpose
An Ignite call is an onboarding catch-up between a garage admin and an affiliate (a user). The meeting itself lives on the external NetworkChains meeting service. This repo stores only a snapshot (`IgniteCallModel` on the backend) and reads status, sessions, recordings and AI notes back through the backend. This module is the typed client used by the one-time-affiliates admin table and its drawers.

## How it works
- Every helper calls `garageAdminApi`, URL-encodes each path segment with `encodeURIComponent`, and returns `.data` from the `{ data }` response.
- **Status.** `IgniteStatus` is `not_scheduled | scheduled | started | completed`. `IGNITE_STATUS_LABEL` is the only place this enum is turned into display text. The backend works out the status from the linked schedule and sessions. An operator can override it with `setIgniteCallCompleted` when the call happened off-platform or the room never recorded a session; this sets or clears `manuallyCompletedAt`.
- **Picker flow.**
  1. Choose an admin.
  2. `listAdminCatchups(adminId)` returns `{ host, schedules }`. `host: null` means that admin has no NetworkChains account; this is a normal outcome that the picker shows, not an error.
  3. `attachIgniteCall(userId, { adminId, ncScheduleId })` links an existing catch-up. `attachIgniteCall(userId, { adminId, createSchedule: { title, scheduledAt, durationMinutes?, timeZone?, description? } })` creates a new one instead.
- **Reschedule.** `rescheduleIgniteCall` updates NetworkChains first (which re-syncs the Google Calendar invite), then the local snapshot. The backend rejects a call that has already started.
- **Detach / list.** `detachIgniteCall` removes a link. `listIgniteCalls(userId)` returns the user's call history, including detached ones (`detachedAt`), without the derived status fields.
- **Related data.** `getIgniteCallRelated(id)` returns `IgniteCallRelated`:
  - the call header;
  - `related`: status, the schedule, meeting sessions (start/end, duration, participants), recordings (with a signed `url` or null), and note sessions with transcript segments and an AI summary (overview, key topics, action items, decisions, questions, markdown);
  - or `related: null` with `unavailableReason`.
- **Privacy.** `AdminCatchup` and the related `schedule` deliberately leave out attendees, `orgId` and description. Per the source comments, an earlier response leaked every attendee email of every catch-up the host runs, so the backend now returns only these fields.

## Exports
- `type IgniteStatus`, `IGNITE_STATUS_LABEL` - the status enum and its display text.
- `type IgniteCallAdmin` - `{ name, email, profilePicture }`.
- `type IgniteCallSummary` - `id`, `adminId`, `admin`, `ncScheduleId`, `ncRoomId`, `title`, `scheduledAt`, `status`, `startedAt`, `endedAt`, `historyCount`, `manuallyCompletedAt?`.
- `type AdminCatchup` - a catch-up the admin can pick (`scheduleId`, `roomId`, `title`, `scheduledAt`, `startedAt`, `durationMinutes`, `timeZone`).
- `type IgniteCallRelated` - see above.
- `listAdminCatchups(adminId)` - `{ host, schedules }`.
- `attachIgniteCall(userId, body)` - `IgniteCallSummary`.
- `detachIgniteCall(userId, id)` - `{ id }`.
- `rescheduleIgniteCall(userId, id, body)` - updated `{ id, ncScheduleId, title, scheduledAt, durationMinutes }`.
- `setIgniteCallCompleted(userId, id, completed)` - `{ id, manuallyCompletedAt }`.
- `listIgniteCalls(userId)` - array of calls, each with `detachedAt`.
- `getIgniteCallRelated(id)` - `IgniteCallRelated`.

## Interfaces
- **Backend endpoints called** (all in `server/routes/garageAdminIgniteCall.ts`, mounted at `/garage-admin`):
  - `GET /backend/garage-admin/admins/:adminId/catchups` - super admin
  - `POST /backend/garage-admin/users/:userId/ignite-call` - super admin; attach or create
  - `DELETE /backend/garage-admin/users/:userId/ignite-call/:id` - super admin; detach
  - `PATCH /backend/garage-admin/users/:userId/ignite-call/:id/reschedule` - reschedule
  - `POST /backend/garage-admin/users/:userId/ignite-call/:id/complete` - body `{ completed }`
  - `GET /backend/garage-admin/users/:userId/ignite-calls` - any admin
  - `GET /backend/garage-admin/ignite-call/:id/related` - any admin
- **External services (through the backend):** the NetworkChains meeting service (`server/lib/ncMeetClient`), which manages schedules, attendees, sessions and recordings, and syncs the Google Calendar invite.

## Dependencies
- **Internal:** `lib/api.ts` - `garageAdminApi`.

## Used by
- `app/garage-admin/(admin-dashboard)/one-time-affiliates/page.tsx`
- `components/garage-admin/IgniteCallDrawer.tsx`
- `components/garage-admin/catchup/IgniteCallScheduleDrawer.tsx`
- `components/garage-admin/ignite-call.tsx`
