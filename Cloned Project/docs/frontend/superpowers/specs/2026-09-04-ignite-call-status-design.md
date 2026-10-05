# Ignite Call Status column — One Time Affiliates

**Date:** 2026-09-04
**Status:** Designed — not yet implemented
**Primary repo:** `client/garage-web-app-nextjs-v1`
**Also touches:** `server/garagenew-backend` (new model + endpoints),
`server/contacts-backend` (new service-token endpoints)

## Goal

Add an **Ignite Call Status** column to
`admin.garage.app/garage-admin/one-time-affiliates`, between "Assigned To" and
"Joining Date". It tracks whether each affiliate has had their Ignite call, and
gives the operator a way to attach that call to a real catch-up and then read
everything the call produced — recording, transcript, AI summary.

Four states:

| Label | Wire value | Meaning |
|---|---|---|
| Not Scheduled | `not_scheduled` | No catch-up attached to this affiliate. |
| Scheduled | `scheduled` | A catch-up is attached and has not started. |
| Started | `started` | The catch-up's room has opened and has not ended. |
| Completed | `completed` | The catch-up's room has ended. |

Beneath the badge, once a call is attached, a muted line shows the call's date
with a `›` appended. Clicking it opens a right-side panel with that call's
related data.

**Out of scope:** the same column on other admin tables. The endpoints are
deliberately shaped so NetworkChain Subs can adopt it later without a second
backend, but this spec ships it on One Time Affiliates only.

## Current state

### The table — `client/garage-web-app-nextjs-v1`

`app/garage-admin/(admin-dashboard)/one-time-affiliates/page.tsx` (1325 lines)
renders through the shared `DataTable`. Its `Row` type is served by
garagenew-backend's `GET /garage-admin/one-time-affiliates`
(`routes/garageAdminOneTimeAffiliates.ts`, 1119 lines).

`components/garage-admin/assign-agent.tsx` is the existing precedent for a "pick
an admin for this row" cell: an `AssignedCell` plus an `AssignAgentDialog`,
gated on `isSuperAdminClient()`, posting to a neutral
`/garage-admin/users/:userId/assign-agent` so every table shares one
assignment. The Ignite call column follows the same shape.

`components/garage-admin/InvoiceDetailDrawer.tsx` and
`AffiliateMemberDrawer.tsx` are the existing right-side panel pattern —
`createPortal` plus a `framer-motion` slide-in, `z-[110]`, backdrop blur.

### Catch-ups — `server/contacts-backend`

Catch-ups are `MeetSchedule` documents (`models/meet-schedule.model.ts`):

- `userId` — the host. `roomId` — a 10-char nanoid.
- `startedAt` — set the first time the host opens the room; `null` until then.
- `attendees[]` — `{ email, displayName }`, emails lowercased and trimmed at
  write time.
- `source: "manual" | "booking"`, `googleCalendarEventId` for the mirrored
  Google Calendar event.

**The artifact join key.** LiveKit room names are `meet-<roomId>`
(`routes/meet.ts:417`, and identically at 509, 586, 660). So from a schedule
alone you can reach every artifact:

```
MeetSchedule.roomId
  → roomName = `meet-${roomId}`
      → MeetSession    (roomName)  — actual sessions, endedAt, participants
      → OfficeRecording(roomName)  — recordings, presigned via S3
      → NoteSession    (roomName)  — → NoteTranscript + NoteSummary
```

This matters: the join does **not** depend on a `MeetSession` existing, so a
catch-up that was scheduled and never joined resolves cleanly to "no artifacts"
rather than erroring.

`services/userScopedReads.ts` already has `meetingsFor`, `recordingsFor`,
`noteSessionsFor`, `noteSessionDetailFor` — but all are scoped **per user**, not
per room. They are the wrong shape here and are left alone.

### Existing service-to-service link

garagenew-backend already calls contacts-backend server-to-server:
`routes/voiceMemos.ts` posts to `NC_BACKEND_URL` with an `X-Service-Token`
header, validated by `requireServiceOrAuth` in contacts-backend
(`middleware/auth.ts:145`) against `VOICE_AGENT_SERVICE_TOKEN`.

That credential is scoped to voice memos. This feature adds its **own** token
rather than widening it — see "Auth" below.

## Design

### Service boundary

All Ignite-call traffic is **browser → garagenew-backend → contacts-backend**.
The browser never holds an NC admin token for this feature.

The alternative — the browser calling contacts-backend directly with the
`ensureNcAdminToken` elevation that the ported NC admin pages use — was
rejected for three reasons:

1. The affiliates list can enrich rows with live status server-side, so the
   column is correct on first paint rather than resolving a beat after the
   table.
2. The NC admin endpoints are `requireSuperAdmin`. Browser-direct would mean
   non-super admins silently see a stale `Scheduled` on rows that had already
   completed — worse than a loading state.
3. CSV export gets the real status, because the server already has it.

### Auth

New `GARAGE_SERVICE_TOKEN` in both services, and a new `requireGarageService`
middleware in contacts-backend. Deliberately **not** a reuse of
`VOICE_AGENT_SERVICE_TOKEN`: that token is scoped to voice memos, and silently
widening it to meeting recordings and transcripts is a trade that should be
made explicitly or not at all.

`requireGarageService` validates `X-Service-Token` only. Unlike
`requireServiceOrAuth` it does **not** fall through to JWT auth and does not
accept an `X-Service-User-Id` — these endpoints act as the platform, not on
behalf of a user, and the acting admin is already recorded on the garagenew
side.

Mutating garagenew endpoints are `requireGarageAdminAuth` +
`requireGarageSuperAdmin`, mirroring `assign-agent`. Read endpoints are
`requireGarageAdminAuth`.

### Data model — garagenew-backend

New `src/models/igniteCall.model.ts`:

| Field | Type | Notes |
|---|---|---|
| `userId` | ObjectId → `User` | The affiliate. |
| `adminId` | ObjectId → `GarageAdmin` | Who conducts the call. |
| `ncHostUserId` | string | The admin's NC user id, resolved at attach time. |
| `ncScheduleId` | string | `MeetSchedule._id` in contacts-backend. |
| `ncRoomId` | string | `MeetSchedule.roomId` — the artifact join key. |
| `title` | string | Snapshot. |
| `scheduledAt` | Date | Snapshot. |
| `detachedAt` | Date \| null | Soft detach; keeps history. |
| `createdBy` | ObjectId → `GarageAdmin` | |
| `createdAt` / `updatedAt` | Date | |

Indexes: `{ userId: 1, detachedAt: 1, scheduledAt: -1 }` for the per-row lookup
and history; unique `{ userId: 1, ncScheduleId: 1 }` so the same catch-up cannot
be attached to the same affiliate twice.

`title` and `scheduledAt` are snapshotted so the cell, the history list, and
CSV export all render when contacts-backend is unreachable, and so history
survives a schedule being deleted in NetworkChains.

**Status is not stored.** It is derived at read time from the live status of the
newest non-detached `IgniteCall`:

```
no live record            → not_scheduled
startedAt == null         → scheduled
startedAt && !endedAt     → started
endedAt                   → completed
```

Storing it would need a webhook pipeline from contacts-backend's meet lifecycle
plus backfill for missed events, and a stale status here is worse than a derived
one.

An affiliate may have **many** Ignite calls over time. The column reflects the
newest live record; the panel lists all of them. This is what makes a no-show
followed by a reschedule legible instead of silently overwriting history.

### contacts-backend — new endpoints

New router `src/routes/service-garage-meet.ts`, mounted at
`/service/garage/meet`, all behind `requireGarageService`.

1. **`GET /host-by-email?email=`** → `{ user: { userId, orgId, name, email } | null }`

   Resolves a Garage admin's email to their NC user. Returns `null` with a 200,
   not a 404 — the UI needs to say "this admin has no NetworkChains account",
   which is a normal outcome, not an error.

2. **`GET /hosts/:ncUserId/schedules?days=60`** → `{ schedules: [...] }`

   That host's upcoming catch-ups, same projection as the existing
   `/admin/meet-manage/scheduled` (`admin-meet.ts:947`): `_id`, `roomId`,
   `title`, `scheduledAt`, `startedAt`, `durationMinutes`.

3. **`POST /hosts/:ncUserId/schedules`** → create a catch-up on that host's
   account. Body: `{ title, scheduledAt, durationMinutes, timeZone,
   description, attendees[] }`.

   The create-and-mirror-to-Google-Calendar logic currently lives inline in
   `POST /meet/schedule` (`routes/meet.ts:697`). Extract it to
   `services/meet/createSchedule.ts` and call it from both, so the admin path
   and the user path cannot drift. This is the one piece of refactoring in this
   spec, and it is load-bearing: a divergent copy would silently stop mirroring
   admin-created calls to Google Calendar.

4. **`POST /schedules/:scheduleId/attendees`** → `{ email, displayName }`

   Idempotent: lowercase and trim, then no-op if that email is already on the
   schedule. Returns the resulting attendee list.

5. **`POST /schedules/status`** → `{ scheduleIds: string[] }` (capped at 100)
   → `[{ scheduleId, scheduledAt, startedAt, endedAt, isLive }]`

   `endedAt` and `isLive` come from `MeetSession` matched on `roomId`. One
   round trip per rendered page of the table.

6. **`GET /schedules/:scheduleId/related`** → the panel payload:

   ```
   { schedule, sessions[], recordings[], noteSessions[] }
   ```

   `recordings[]` carry presigned playback URLs (1h expiry, as
   `recordingsFor` does). Each `noteSessions[]` entry carries its
   `NoteTranscript` and `NoteSummary` inline — the panel shows one call, so a
   second round trip per note session is not worth the latency.

### garagenew-backend — new endpoints

New `src/routes/garageAdminIgniteCall.ts`, plus a change to the affiliates list.

- **`GET /garage-admin/one-time-affiliates`** — each row gains:

  ```
  igniteCall: {
    id, adminId, admin: { name, email, profilePicture },
    ncScheduleId, ncRoomId, title, scheduledAt,
    status, startedAt, endedAt, historyCount
  } | null
  ```

  `status` is the wire enum `not_scheduled | scheduled | started | completed`;
  the display labels in the table are a frontend concern.

  Implementation: batch-load live `IgniteCall`s for the page's `userId`s, then
  call contacts-backend endpoint 5 with their `ncScheduleId`s, **chunked into
  batches of 100** to stay under that endpoint's cap. Chunking is required, not
  defensive: CSV export pages this same endpoint at `EXPORT_PAGE_SIZE = 200`
  (page.tsx:145), so a single request can carry up to 200 linked rows.

  **Fail-soft** — if the call errors or times out, fall back to the snapshot
  and report `status: "scheduled"` rather than failing the whole list.

- **`POST /garage-admin/users/:userId/ignite-call`** (super only) — attach an
  existing catch-up, or create one and attach it, then idempotently add the
  affiliate as an attendee. Body carries either `ncScheduleId` or a
  `createSchedule` payload, plus `adminId`.

- **`DELETE /garage-admin/users/:userId/ignite-call/:id`** (super only) — soft
  detach; sets `detachedAt`.

- **`GET /garage-admin/users/:userId/ignite-calls`** — full history, each entry
  with its related data, for the panel.

Paths are neutral (`/garage-admin/users/:userId/...`) exactly as `assign-agent`
does, so a second table adopting this column needs no new backend.

### Frontend

**`components/garage-admin/ignite-call.tsx`** — modelled on `assign-agent.tsx`.

- `IgniteCallCell` — the status badge, plus (when a call is attached) a muted
  second line `Sep 12, 3:00 PM ›` that opens the panel. Non-super admins see
  the badge and the muted line but no picker affordance.
- `IgniteCallDialog` — two steps:
  1. Pick the admin who will conduct the call, from
     `GET /garage-admin/admins` (the list `assign-agent` already uses), showing
     the same `RoleChip`.
  2. Show that admin's upcoming catch-ups. If they have none — or no NC account
     at all — say so explicitly, and offer **"Schedule a new catch-up"**
     (title, date/time, timezone, duration), which creates it on their account
     with the affiliate already an attendee.

**`components/garage-admin/IgniteCallDrawer.tsx`** — the related-data panel.
Same portal + `framer-motion` shell as `InvoiceDetailDrawer`. Sections: header
(affiliate, admin, when, status), Recordings (inline `<video>` off the presigned
URL), Transcript, AI Summary, Participants. Earlier calls for the same affiliate
are listed below, collapsed.

**`one-time-affiliates/page.tsx`** — one new `ColumnDef`:

```
id: "igniteCall", width ~200, minWidth ~180,
skeleton: two stacked bars   // the cell is two lines; a single grey bar
                             // makes the table visibly rearrange on load
```

Placed between `assignedTo` and `joining`, matching the screenshot.

**Neither `sortable` nor `filterable`** — matching `assignedTo` (page.tsx:948),
the closest analogue. This table paginates server-side, so a sortable or
filterable column must be handled by garagenew. It cannot be: `Started` and
`Completed` are derived from contacts-backend state that garagenew only holds
for the rows on the current page, so ordering or filtering the full result set
by status is not possible without replicating meet state into garagenew — the
webhook pipeline this design deliberately avoids. Client-side filtering was
also rejected: it would silently match one page out of many, which the
`ColumnDef.filterAccessor` doc calls out as worse than no filter.

Sorting and filtering by Ignite call status is a reasonable future ask, but it
needs the stored-status design (approach B) and should be scoped as such.

The status is added to `CSV_COLUMNS` so exports carry it.

### Behaviour on attach

1. Operator picks an admin, then one of that admin's catch-ups (or creates one).
2. garagenew resolves the admin's NC user by **email**, writes the `IgniteCall`,
   and adds the affiliate to the catch-up's attendees — skipping the write if
   they are already listed.
3. The row flips to `Scheduled`. `Started` and `Completed` follow the real room
   with no further operator action.

The picker lists a host's catch-ups **unfiltered** — an operator can attach a
call that has no prior connection to this affiliate. That is intentional:
catch-ups are typically scheduled before anyone decides whose Ignite call it is.

### Failure modes

| Condition | Behaviour |
|---|---|
| contacts-backend unreachable during list | Column degrades to the snapshot state; list still renders. |
| Admin's email has no NC account | Picker says so explicitly; no empty list. |
| Schedule deleted in NC after attach | Snapshot keeps the cell readable; panel shows "no longer available". |
| Catch-up scheduled but never joined | Panel renders with empty artifact sections, not an error. |
| `GARAGE_SERVICE_TOKEN` unset | contacts-backend returns 503; garagenew fails soft on reads, and surfaces a clear error on writes. |

## Testing

**contacts-backend**
- `meet-<roomId>` artifact join: with sessions, recordings and note sessions;
  and the never-joined case resolving to empty rather than throwing.
- Idempotent attendee add: new email appended; existing email (and a
  differently-cased duplicate) a no-op.
- Batch status: cap enforced at 100; unknown ids omitted rather than erroring.
- `createSchedule` extraction: the existing `POST /meet/schedule` behaviour is
  unchanged, including the Google Calendar mirror.

**garagenew-backend**
- Four-state derivation across all branches, including newest-record-wins with
  multiple history entries.
- Attach: creates the record, resolves the NC host, adds the attendee once.
- Detach: soft, and the next-newest record does not become live.
- List enrichment fails soft when contacts-backend errors or times out.
- Enrichment chunks at 100: a 200-row export page issues two batches and
  returns a status for every linked row.

## Deployment

`GARAGE_SERVICE_TOKEN` must be set on **both** Railway services before this
works in production. Until then contacts-backend returns 503 and the column
reads `Not Scheduled` / snapshot everywhere — degraded, not broken.

No migration. `IgniteCall` starts empty and every affiliate reads
`Not Scheduled`, which is correct.
