# `server/utils/meetCode.ts`

> Module exporting `generateMeetJoinCode`, `generateMeetAgoraChannel`, `isScheduledInterviewMeet`, `verifyMeetJoinCode` and 1 more.

**Kind:** backend utility · **Lines:** 123

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `generateMeetJoinCode` | function | `generateMeetJoinCode(): string` — Generate a unique meet join code Format: meet_{12-char-alphanumeric} | 11 |
| `generateMeetAgoraChannel` | function | `generateMeetAgoraChannel(meetId: string): string` — Generate Agora channel name for a meet | 21 |
| `isScheduledInterviewMeet` | function | `async isScheduledInterviewMeet(code: string): Promise<boolean>` — Whether this meet is the call for a Jobs interview that is still scheduled. | 32 |
| `verifyMeetJoinCode` | function | `async verifyMeetJoinCode(code: string): Promise<{ meetId: string; meet: { id: string; tit…` — Verify a meet join code and get meet details | 42 |
| `isHostEmail` | function | `async isHostEmail(code: string, email: string): Promise<boolean>` — Check if an email is the host of a meet | 111 |

## Interfaces

- **Database (Mongoose models used):**
  - `JobInterview` (server/models/jobInterview.model.ts) — reads: `exists`
  - `Meet` (server/models/meet.model.ts) — reads: `findOne`
  - `Workshop` (server/models/workshop.model.ts) — reads: `findOne`

## Dependencies

- **Internal:**
  - `server/models/meet.model.ts` — `Meet`
  - `server/models/workshop.model.ts` — `Workshop`
  - `server/models/jobInterview.model.ts` — `JobInterview`
- **Packages:**
  - `crypto` — `randomBytes`

## Used by

- `server/routes/meet.ts`
- `server/routes/publicMeet.ts`
- `server/routes/webinarRoutes.ts`
- `server/routes/workshop.ts`
- `server/services/jobs.ts`
