# `server/utils/recordingTime.ts`

> Recording start time, derived from the S3 key.

**Kind:** backend utility · **Lines:** 20

<!-- docgen:auto -->

## Purpose
Recording start time, derived from the S3 key.

Keys look like `webinar-recordings/<workshopId>/2026-08-15T142835.mp4`,
where the timestamp is when the egress STARTED. The file document's
`createdAt` is when the upload finished — on a two-hour stream those are
two hours apart, which is useless for lining chat up against playback.

Shared by the authed recordings list and the public single-recording
lookup: both anchor the watch page's chat and pin replays, so they have to
agree on where zero is.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `recordingStartedAt` | function | `recordingStartedAt(s3Key: string, fallback: Date): Date` — Recording start time, derived from the S3 key. | 13 |

## Interfaces

None detected: no endpoints, events, data access or environment reads were found.

## Dependencies

- **Internal:** none
- **Packages:** none

## Used by

- `server/routes/public.ts`
- `server/routes/webinarRoutes.ts`
