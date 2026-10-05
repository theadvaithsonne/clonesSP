# `lib/content-tracker.ts`

> Client-side engagement tracker that accumulates watch/read metrics for one viewing session of a public content page and reports them to the backend by heartbeat and an exit beacon.

**Kind:** frontend library · **Lines:** 322

## Purpose
Founders and affiliates want to know who actually watched or read the content they share (including sessions that came through an affiliate link). Guest-facing content pages create one `ContentTracker` per view, feed it player and scroll events, and the tracker periodically posts a cumulative session summary to `POST /backend/content-engagement/ingest`. Those summaries are what `lib/content-analytics-api.ts` later reads back as aggregated analytics.

## How it works

### Session state
The constructor creates a session ID (`<base36 timestamp>_<random>`) and an in-memory `SessionState`: total watch time, total read time, watched ranges (`[start, end]` in content seconds), completion percent, max playback rate, max scroll depth, interaction counters (plays, pauses, seeks, replays, mutes, unmutes, fullscreens, link clicks), and completion flag. Every report sends the **whole cumulative state** for the session, not a delta, so the backend can upsert one document per `(sessionId, contentId)` and repeated sends are harmless.

### Video / drop / recording events
- `onPlay(currentTime)` counts a play and records the wall-clock start and the playback position where the range starts.
- `onPause(currentTime)` counts a pause and closes the open range via `accumulateWatchTime`.
- `onSeek(from, to)` counts a seek; if playing, it closes the range watched before the seek (only if more than 0.5 s elapsed) and opens a new range at `to`, so the skipped gap is not counted as watched.
- `onTimeUpdate(currentTime)` raises `completionPercent` to `currentTime / duration` (never lowers it) when `config.duration` is set; 95% or more marks the session complete.
- `onEnded()` forces completion to 100% and closes the open range.
- `onReplay`, `onMute`, `onUnmute`, `onFullscreen` just bump counters; `onPlaybackRateChange(rate)` keeps the maximum rate seen.

Range length is computed from wall-clock elapsed time (`Date.now()` difference), not from the player position, and a range shorter than 0.5 s is discarded.

### Article events
- `startReading()` / `stopReading()` bracket active reading time into `totalReadTime`.
- `onScroll(depthPercent)` keeps the maximum scroll depth and uses it as `completionPercent`; 95% or more marks the session complete.
- `onLinkClick()` counts outbound link clicks.

### Building and sending the payload
`buildPayload()` adds any currently open play or read interval to the totals without closing it, merges overlapping watched ranges (`mergeRanges`), and attaches `deviceType` (from `window.innerWidth`: under 768 mobile, under 1024 tablet, else desktop), the user agent (truncated to 500 chars), `document.referrer` (2000 chars), the content title (300 chars) and the config IDs (`contentId`, `contentType`, `orgId`, `affiliateId`, `userId`, `guestId`). These limits mirror the server's zod schema.

- `flush()` posts the payload with `fetch(..., { keepalive: true })`, ignoring all errors. It runs every `HEARTBEAT_MS` (30 s) and whenever the tab becomes hidden (`visibilitychange`).
- On `beforeunload`, and when `destroy()` is called, `sendBeacon()` uses `navigator.sendBeacon` with a JSON `Blob`, falling back to a keepalive `fetch` if the Beacon API is missing.
- `destroy()` is idempotent: it stops the heartbeat, sends the final beacon, and removes the window/document listeners. After it runs, `flush()` is a no-op.

## Exports
- `ContentTracker` (class) - `new ContentTracker(config: TrackerConfig)`; methods `onPlay`, `onPause`, `onSeek`, `onReplay`, `onMute`, `onUnmute`, `onFullscreen`, `onPlaybackRateChange`, `onTimeUpdate`, `onEnded`, `startReading`, `stopReading`, `onScroll`, `onLinkClick`, `flush`, `destroy`; static `HEARTBEAT_MS = 30000`.
- `ContentType` - `"video" | "drop" | "article" | "recording" | "testimonial"` (same list as `CONTENT_TYPES` in `server/models/contentEngagement.model.ts`).
- `TrackerConfig` - `{ contentId, contentType, orgId, contentTitle, affiliateId?, userId?, guestId?, duration? }`; `duration` is in seconds and is needed for video completion.

## Interfaces
- **Backend endpoints called:** `POST /backend/content-engagement/ingest` - public (no auth header is sent), validated by zod, rate-limited in memory to 20 requests per minute per `sessionId`; upserts a `ContentEngagement` session document.
- **Background work:** a 30 s `setInterval` heartbeat per tracker; `beforeunload` and `visibilitychange` listeners.

## Dependencies
- **Internal:** `lib/api.ts` - `API_URL` (the `/backend` base URL). It deliberately uses raw `fetch`/`sendBeacon` rather than `api()` so requests survive page unload and carry no token.

## Used by
Guest content pages under `app/guest/[slug]/...`: `article/[postId]/ArticlePageClient.tsx`, `drop/[dropId]/DropPageClient.tsx`, `recording/[recordingId]/RecordingPageClient.tsx`, `testimonials/[testimonialSlug]/TestimonialDetailClient.tsx`, `video/[videoId]/VideoPageClient.tsx` (browser URLs `/guest/<slug>/article/<postId>` and so on).

## Notes
- Callers must call `destroy()` on unmount; otherwise the interval and listeners leak and keep posting.
- The server validates `contentId`, `orgId` and `userId` as Mongo ObjectIds and returns 400 otherwise; errors are swallowed, so a bad config fails silently.
- Watched ranges assume 1x speed (wall-clock seconds added to the start position), so at higher playback rates ranges and watch time understate the portion of content covered.
- Hiding the tab triggers a flush but does not pause timers: unless the page calls `onPause`/`stopReading`, time spent hidden still counts as watch/read time.
- `beforeunload` plus `destroy()` can send two final beacons; this is harmless because ingest is an upsert of cumulative values.
- `mergeRanges` mutates the end value of entries in its working copy; `buildPayload` passes a shallow copy of the array, but the tuples are shared with state, so stored ranges can be widened in place. The effect is only on already-overlapping ranges.
