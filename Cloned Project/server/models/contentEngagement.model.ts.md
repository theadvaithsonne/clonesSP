# `server/models/contentEngagement.model.ts`

> Mongoose model holding one engagement summary per viewer session per content item (video, drop, article, recording, testimonial), used for analytics and affiliate attribution.

**Kind:** Mongoose model · **Lines:** 221

## Purpose
Front-end players and article pages send periodic "heartbeats" with accumulated viewing/reading metrics. Rather than storing every event, the backend upserts a single summary document keyed by the client-generated `sessionId` plus `contentId`. The data powers founder analytics (per-content stats, overview, leaderboards) and reports of how much engagement each affiliate's referral link drove.

## How it works
- **Identity:** `sessionId` (client UUID, the idempotency key), `contentId` (ObjectId of a Post/StandaloneVideo/Drop/Testimonial/recording - no `ref`, since it is polymorphic), `contentType` (`CONTENT_TYPES`), `orgId`.
- **Attribution:** `affiliateId` (the raw `referCode` from the URL) and `affiliateUserId` (the resolved User id).
- **Viewer:** `userId` for signed-in viewers and/or `guestId` (the `guest_user_id` kept in the browser's localStorage).
- **Video metrics:** `totalWatchTime` (seconds actually played), `watchedRanges` (array of `[startSec, endSec]` pairs, stored as `[[Number]]`), `completionPercent` (0-100), `maxPlaybackRate` (default 1).
- **Article metrics:** `totalReadTime`, `scrollDepthMax` (0-100).
- **Interactions:** counters `plays`, `pauses`, `seeks`, `replays`, `mutes`, `unmutes`, `fullscreens`, `linkClicks`.
- **Context:** `deviceType` (`mobile`/`tablet`/`desktop`/`unknown`), `userAgent`, `referrerUrl`, `contentTitle` (denormalised so reports need no joins).
- **Lifecycle:** `sessionStart`, `lastUpdate`, `heartbeatCount`, `isComplete`; plus `timestamps`.

**How it is written** (`POST /content-engagement/ingest` in `server/routes/contentEngagement.ts`): a single `findOneAndUpdate({sessionId, contentId}, ..., {upsert: true})` that `$set`s the latest accumulated metrics and interaction counts, `$max`es `scrollDepthMax` and `maxPlaybackRate`, `$inc`s `heartbeatCount`, and `$setOnInsert`s identity/attribution/context fields and `sessionStart`.

**Indexes:**
- `session_content_unique` - unique `{sessionId, contentId}` (enforces one doc per session per content).
- `content_analytics_idx` `{orgId, contentType, contentId, sessionStart:-1}`.
- `affiliate_perf_idx` `{orgId, affiliateId, sessionStart:-1}` and `affiliate_type_idx` `{orgId, affiliateId, contentType, sessionStart:-1}`.
- `org_timeline_idx` `{orgId, sessionStart:-1}`.
- `user_history_idx` and `guest_history_idx` (sparse) for viewer history.
- Plus single-field indexes on `sessionId`, `contentId`, `orgId`, `affiliateId`, `affiliateUserId`.

## Exports
- `ContentEngagement` - Mongoose model (`"ContentEngagement"`, collection `contentengagements`).
- `CONTENT_TYPES` / `ContentType` - `"video" | "drop" | "article" | "recording" | "testimonial"`.
- `DEVICE_TYPES` / `DeviceType` - `"mobile" | "tablet" | "desktop" | "unknown"`.
- `IInteractions` - interaction counter shape.
- `WatchedRange` - `[number, number]`.
- `IContentEngagement` - document interface.

## Interfaces
- **Database:** `ContentEngagement` (collection `contentengagements`); refs `Organization`, `User`.

## Dependencies
- **Packages:** `mongoose`.

## Used by
`server/routes/contentEngagement.ts`, mounted at `/content-engagement` (browser `/backend/content-engagement`): public `POST /ingest`, and authenticated `GET /stats/:contentType/:contentId`, `/affiliate-report`, `/overview`, `/leaderboard/:contentType` aggregations.

## Notes
- The `IInteractions` comment says each field is `$inc`'d, but the ingest route actually `$set`s them to the client's accumulated totals. The client is the source of truth for these counts.
- `sparse: true` on the compound user/guest history indexes has little effect because `userId`/`guestId` default to `null` (null values are still indexed).
- The ingest endpoint is unauthenticated, so all metrics are client-reported and can be spoofed; treat them as analytics, not as a basis for payouts.
