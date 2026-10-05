# `server/services/studySession.ts`

> Module exporting `startSession`, `endSession`, `heartbeat`, `getStudyStats`.

**Kind:** backend service · **Lines:** 358

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `startSession` | function | `async startSession(data: { userId: string; organizationId: string; courseId: s…): Promise<IStudySession>` — Start a new study session. | 61 |
| `endSession` | function | `async endSession(userId: string, orgId: string, sessionId?: string): Promise<IStudySession \| null>` — End the current active study session. | 118 |
| `heartbeat` | function | `async heartbeat(userId: string, orgId: string, data?: { chapterId?: string; sectionId?: string; chapterTit…): Promise<IStudySession \| null>` — Heartbeat to keep the session alive. | 151 |
| `getStudyStats` | function | `async getStudyStats(userId: string, orgId: string): Promise<{ weeklyTime: number[]; // minutes per da…` — Get dashboard stats for a learner. | 186 |

## Interfaces

- **Database (Mongoose models used):**
  - `StudySession` (server/models/studySession.model.ts) — reads: `find`, `findOne`; **writes:** `bulkWrite`, `new + save`

## Dependencies

- **Internal:**
  - `server/models/studySession.model.ts` — `StudySession`, `IStudySession`
- **Packages:**
  - `mongoose` — `Types`

## Used by

- `server/routes/studySession.ts`
