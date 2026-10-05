# Evergreen Webinars — Design

**Date:** 2026-09-07
**Status:** Approved for planning
**Repos:** `garagenew-backend` (API, model, clock), `garage-web-app-nextjs-v1` (room, admin)

## Goal

Let a host publish a webinar **once** and have it run on a recurring schedule as a
synchronised broadcast: the host records or uploads a video in advance, sets a
recurrence, and every attendee who joins a given session sees **the same moment of
the video at the same wall-clock time**.

The point is that the session feels like a scheduled broadcast rather than a video
page. Everything that makes the existing live room feel live — chat, presence,
the join flow — is kept; only the media source changes.

## Hard constraint: purely additive — both modes coexist

Evergreen is a **second mode alongside** the existing live webinar, never a
replacement. Normal live webinars must keep working exactly as they do today.

This is a requirement, not an aspiration, so it is stated as rules the
implementation is held to:

1. **No existing behaviour is modified or removed.** No live-webinar route,
   socket handler, model field, or component is deleted or repurposed.
2. **Absent `evergreen` = today's behaviour.** The flag defaults to `false`, and
   every code path branches on `evergreen.enabled === true`. A workshop without
   the field takes the identical path it takes now.
3. **One additive branch, taken early.** The room checks the flag *before* it
   would join mediasoup/LiveKit, and returns. The live path below it is left
   untouched rather than made conditional throughout.
4. **The two share, never fight over, the same surfaces.** Registration, pricing,
   recurrence, chat, presence, and knock/admit are common to both. Only the media
   source differs — live SFU vs `<video>`.
5. **A host can flip a webinar between modes** without losing registrations or
   history; turning evergreen off restores the live behaviour exactly.
6. **Regression bar:** a live webinar must be startable, joinable, and recordable
   with evergreen code deployed. This is an explicit test, not an assumption.

## Non-goals (v1)

- Per-viewer branching or personalised video
- Timed CTA / offer popups (cheap to add later once the clock exists — deliberately deferred)
- Email/reminder sequences
- Transcoding or adaptive bitrate (we serve the uploaded file as-is)

## Terminology

- **Occurrence / session** — one scheduled run, produced by the existing recurrence engine.
- **Session start** — the wall-clock start of that occurrence, in the workshop's timezone.
- **Position** — how far into the video the session currently is: `now − sessionStart`.

## 1. Data model

Additive to `Workshop` (`src/models/workshop.model.ts`). No migration: absent
`evergreen` means the workshop behaves exactly as it does today.

```ts
evergreen: {
  enabled:      { type: Boolean, default: false },
  source:       { type: String, enum: ["upload", "recording"] },
  videoUrl:     String,          // S3 object URL or LiveKit egress output
  videoS3Key:   String,          // set for the upload path; enables deletion
  durationSec:  Number,          // REQUIRED when enabled — drives the clock
  joinWindowMin: Number,         // optional late-join cutoff; null = join anytime
  simulatedChat: [{              // host-authored, ordered by atSec
    atSec:   Number,
    name:    String,
    message: String,
  }],
  simulatedViewers: {
    enabled: { type: Boolean, default: false },
    peak:    Number,             // max synthetic viewers
  },
}
```

`durationSec` is mandatory whenever `enabled` is true. Without it the clock cannot
decide when a session has ended, so the model validates this rather than letting a
half-configured webinar go live.

The existing top-level `videoUrl` field is left alone — it belongs to courses and
reusing it would couple two unrelated features.

## 2. Scheduling — reuse, don't rebuild

No new scheduler. A session is an occurrence produced by `calculateSessions` /
`getNextSession` in `src/utils/recurrence.ts`, which is already timezone-aware and
supports daily/weekly/monthly plus `excludedDays`.

"24/7" is expressed as a daily recurrence; back-to-back sessions come from the
existing pattern rather than a new concept.

**Known constraint to guard:** `isSessionDate()` returns `false` for an unknown
`recurrencePattern.type`, so a pattern missing `type` yields no sessions. Enabling
evergreen must validate that `recurrencePattern.type` is one of
`daily | weekly | monthly`. (A live example of this already exists in prod — the
"GoToBigWin" workshop has `{"excludedDays":[]}` with no `type`.)

## 3. The clock — server-authoritative

One new public endpoint. The client never computes position itself; this is what
makes every viewer agree and makes client clock skew irrelevant.

```
GET /public/webinar/:id/evergreen-state?sessionDate=YYYY-MM-DD
```

```jsonc
{
  "enabled": true,
  "serverNow": 1788800000000,
  "sessionStart": 1788799400000,
  "positionSec": 600,
  "durationSec": 3600,
  "status": "live",            // "upcoming" | "live" | "ended"
  "nextSessionAt": 1788885800000,
  "joinWindowClosed": false,
  "videoUrl": "https://…"      // omitted unless status === "live"
}
```

Rules:
- `positionSec = (serverNow − sessionStart) / 1000`
- `status = "upcoming"` when `positionSec < 0`; `"live"` when `0 ≤ positionSec < durationSec`; `"ended"` otherwise
- `joinWindowClosed = joinWindowMin != null && positionSec > joinWindowMin * 60`
- `videoUrl` is withheld unless the session is live, so the asset URL is not
  harvestable from an upcoming session
- `Cache-Control: no-store` — the response is time-dependent (the same reason
  `/public/webinar/validate` already sets it)

`sessionDate` is optional; omitted resolves to the current or next occurrence.

## 4. Playback (client)

`WebinarRoomClient.tsx` gains an evergreen branch **before** it connects to
mediasoup/LiveKit. In evergreen mode it renders a `<video>` element and never joins
the SFU — this is the main structural change and it must short-circuit early so no
media transport is created.

- On entry: fetch state, `video.currentTime = positionSec`, play
- **Forward seeking is blocked** at the live edge — the single rule that makes it
  read as a broadcast. `seeking` handler clamps `currentTime` back to the allowed
  position
- **Drift correction:** re-fetch state every 30s; if `|video.currentTime − positionSec| > 2`, re-seek
- `upcoming` → countdown screen (reuses the existing not-started UI)
- `ended` → next-session screen
- Chat, presence, and knock/admit behave exactly as they do today

Autoplay: browsers block unmuted autoplay, so entry requires a click ("Join
session"), which we already have in the pre-join flow.

## 5. Simulated chat

Rendered client-side from `simulatedChat`, gated on the same clock: a message shows
when `atSec <= positionSec`. A late joiner therefore sees the same backlog everyone
else saw, which is consistent with the synchronised position. Real attendee messages
interleave by arrival time.

Messages are **authored by the host** in the admin editor. The system never invents
participants or text — the host owns every word, which keeps the feature controllable
and reviewable.

`simulatedViewers` (if enabled) renders a count that ramps toward `peak` and
tapers near the end; it is presentational only and never mixed into real presence
state, so moderation and admit/kick continue to operate on real users only.

## 6. Video ingestion — both paths

**Upload**
1. `POST /garage-admin/webinars/:id/evergreen/upload-url` → presigned S3 PUT
2. Client uploads directly to S3
3. `POST …/evergreen/attach` with `{ s3Key, durationSec }` → writes `videoUrl`,
   `videoS3Key`, `durationSec`, `source: "upload"`

Duration is taken from the browser's `loadedmetadata` and validated server-side as
a positive number; a missing/zero duration rejects the attach.

**Record**
Reuses the existing LiveKit Egress flow in `src/routes/livekitRecording.ts`
(`/recording/start`, `/recording/stop`, and the `egress_ended` webhook). The webhook
handler gains a branch: when the finished egress belongs to a workshop flagged for
evergreen capture, it writes the output URL and duration into `evergreen` and sets
`source: "recording"`.

## 7. Admin UI

In the existing webinar editor:
- Evergreen toggle
- Video picker: upload, or "use a recording of this webinar"
- Recurrence editor (existing component) — with validation that `type` is set
- Chat-script editor: rows of `timestamp | name | message`, sorted on save
- Optional viewer-count settings

## 8. Permissions & error handling

- The state endpoint is public (like `/validate`) but returns `videoUrl` only while live
- Admin/config endpoints sit behind the existing garage-admin auth + page gate
- Evergreen cannot be enabled without: `durationSec > 0`, a `videoUrl`, and a valid
  `recurrencePattern.type` — the API rejects the write rather than shipping a
  broken session
- If `videoUrl` 404s at playback, the room shows the existing error state; it does
  not silently fall through to a live join

## 9. Testing

- **Unit — clock:** upcoming / live / ended boundaries, `positionSec` at exact
  session start and at `durationSec`, `joinWindowClosed` on/off
- **Unit — recurrence guard:** a pattern with no `type` is rejected at enable time
- **Unit — chat gating:** only `atSec <= positionSec` messages render; ordering stable
- **Integration:** two clients joining 5 minutes apart report positions within 2s of
  each other (the core promise)
- **Integration:** forward-seek attempt is clamped
- **Regression (required):** with evergreen code deployed, a normal live webinar
  still starts, admits attendees, streams via the SFU, and records — and a
  workshop with no `evergreen` field takes the unchanged live path
- **Manual:** upload path end-to-end, recording path end-to-end

## 10. Rollout

`evergreen.enabled` defaults false, so every existing webinar is untouched. The room
only diverges when the flag is on. Ship the upload path first (no dependency on
having run a live session), then the recording path.
