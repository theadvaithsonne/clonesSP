# `lib/affiliate/downline-livestreams-api.ts`

> Typed client for a downline member profile's "Live Streams" tab and its per-session drill-down.

**Kind:** frontend library · **Lines:** 118

## Purpose
This file feeds the Live Streams tab of a member profile, which opens from the garage-admin console and from the downline speakers drawer. Each row is a live stream (a webinar or workshop) the member **registered** for, so free streams appear too, not only paid invoice lines. The backend serves these rows from its own service, separate from the founder console's stream table.

## How it works
- Both calls go through `garageAdminApi` from `lib/api.ts`, not the user `api()`. The admin panel is a separate session with no user JWT. The backend routes are guarded by `requireUserOrGarageAdmin`, which accepts either a user JWT or a garage-admin token.
- `fetchMemberLiveStreams(userId)` returns one row per stream. A missing `rows` field becomes `[]`.
- `fetchMemberLiveStreamSessions(userId, workshopId)` returns one row per session of a recurring stream, plus `workshopTitle` (`null` if missing).
- Both functions URL-encode their path segments.
- Rules for the `MemberLiveStreamRow` shape, as documented in the type:
  - `id` is the workshop id on a stream row, and `<workshopId>:<sessionISO>` on a session row. `sessionNumber` and `sessionDate` exist only on session rows.
  - `dateTime` is `null` on a recurring stream row. The UI shows a drill-down button there instead, because a series has many dates.
  - `enrollmentPrice` is `null` on a per-session stream row. Each session row carries its own price.
  - `youEarnedFromEnrollment` is in **cents** and is the **caller's** commission, so it is 0 when an admin is viewing.
  - `attendance` stays `"not_applicable"` until the session has been delivered.
  - `enrolment` (`registered` or `cancelled`) is the member's own state. It is separate from `status`, which is the stream's state.
  - `speakers` lists the host first, then co-hosts. Their email tells apart accounts that share a name.

## Exports
- `MemberStreamStatus` - `"active" | "completed" | "deleted" | "not_started"`.
- `MemberStreamFrequency` - `"one_time" | "recurring"`.
- `MemberStreamEnrollment` - `"na" | "once" | "per_session"` (`na` for non-recurring streams).
- `MemberLiveStreamRow` - the row shape described above. It also includes `office`, `createdBy`, `compPlan` levels, `affiliateUrl`, `liveSelling` (`purchases`, `volumeUsd`, `youEarnedUsd`), `rating` and `review`.
- `fetchMemberLiveStreams(userId: string): Promise<{ rows: MemberLiveStreamRow[] }>`
- `fetchMemberLiveStreamSessions(userId: string, workshopId: string): Promise<{ rows: MemberLiveStreamRow[]; workshopTitle: string | null }>`

## Interfaces
- **Backend endpoints called:**
  - `GET /backend/affiliate/downline/:userId/live-streams` - the member's registered streams.
  - `GET /backend/affiliate/downline/:userId/live-streams/:workshopId/sessions` - session rows for one recurring stream.

  Both are served by `server/routes/downlineProfile.ts`, which is mounted at `/affiliate` in `server/app.ts`.
- **Browser storage / cookies:** `garageAdminApi` reads `garage_admin_token` from localStorage.

## Dependencies
- **Internal:** `lib/api.ts` - `garageAdminApi`.

## Used by
- `components/downline/speakers-drawer.tsx`
- `components/garage-admin/member-profile-view.tsx`
