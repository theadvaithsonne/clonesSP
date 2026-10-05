# `server/models/studySession.model.ts`

> Mongoose model recording time a learner spends studying a course (start, heartbeat, end, duration), used for study-time statistics.

**Kind:** Mongoose model · **Lines:** 53

## Purpose
Courses track how long a user actively studies. The frontend starts a session, sends periodic heartbeats and ends it. Each row is one continuous study session for one user, in one organisation, on one course (optionally narrowed to a chapter or section). Weekly and total study statistics are aggregated from these rows.

## How it works
### Fields
| Field | Type | Notes |
|---|---|---|
| `userId` | ObjectId | required, indexed |
| `organizationId` | ObjectId | required, indexed |
| `courseId` | ObjectId -> `Course` | required |
| `chapterId`, `sectionId` | ObjectId | optional position in the course |
| `startedAt` | Date | required, default now |
| `endedAt` | Date | null or absent while the session is active |
| `duration` | Number | total seconds, default 0 |
| `lastHeartbeat` | Date | required, default now |
| `courseTitle`, `chapterTitle` | String | denormalised for quick reads, default `""` |
`timestamps: true`.

### Indexes
- `{ userId, startedAt: -1 }` - a user's history.
- `{ userId, organizationId, startedAt: -1 }` - history per org.
- `{ userId, organizationId, endedAt }` - finds the active session (`endedAt: null`), the most frequent query.

## Exports
- `StudySession` - Mongoose model `"StudySession"` (collection `studysessions`).
- `IStudySession` - document interface.

## Interfaces
- **Database:** `StudySession` (collection `studysessions`), read and written by the study-session service.

## Dependencies
- **Packages:** `mongoose`.

## Used by
- `server/services/studySession.ts` (`startSession`, `endSession`, `heartbeat`, `getStudyStats`). Before it starts a new session, that service closes stale sessions (no heartbeat for the heartbeat timeout) with a `bulkWrite`: it sets `endedAt = lastHeartbeat` and computes a capped `duration`.
- Reached through `server/routes/studySession.ts`, mounted at `/study-sessions` (browser: `/backend/study-sessions/start`, `/end`, `/heartbeat`, `/stats`).
