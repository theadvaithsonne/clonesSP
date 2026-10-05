# `server/services/webinarRecording.ts`

> Module exporting `startServerRecording`, `stopServerRecording`, `isRecording`, `sweepOrphanSegments`.

**Kind:** backend service · **Lines:** 813

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `startServerRecording` | function | `async startServerRecording(webinarId: string, hostUserId: string): Promise<{ success: boolean; error?: string }>` | 91 |
| `stopServerRecording` | function | `async stopServerRecording(webinarId: string): Promise<{ success: boolean; error?: string; segme…` | 210 |
| `isRecording` | function | `isRecording(webinarId: string): boolean` | 302 |
| `sweepOrphanSegments` | function | `async sweepOrphanSegments(olderThanMs = 2 * 24 * 60 * 60 * 1000)` — Orphan sweeper — deletes segment files older than 2 days. | 565 |

## Interfaces

- **Database (Mongoose models used):**
  - `Workshop` (server/models/workshop.model.ts) — reads: `findById`
  - `OrganizationCabinet` (server/models/cabinet.model.ts) — reads: `findOne`; **writes:** `create`
  - `OrganizationFile` (server/models/cabinet.model.ts) — **writes:** `create`
- **Environment variables (`process.env`):** `AWS_S3_BUCKET`, `AWS_S3_REGION`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`
- **Timers / queues:** `setTimeout` at L164, L231, L262; `setInterval` at L190
- **Filesystem writes:** `mkdirSync(sessionDir)` (L131), `writeFileSync(sdpPath)` (L135), `rmSync(session.sessionDir)` (L276), `unlinkSync(localPath)` (L354), `writeFileSync(localPath)` (L414), `writeFileSync(concatListPath)` (L421)

## Dependencies

- **Internal:**
  - `server/services/mediasoup.ts` — `getRoom`, `WebinarRoom`
  - `server/services/s3.ts` — `s3Service`
  - `server/models/cabinet.model.ts` — `OrganizationFile`, `OrganizationCabinet`
  - `server/models/workshop.model.ts` — `Workshop`
- **Packages:**
  - `child_process` — `spawn`, `ChildProcess`
  - `fs`
  - `path`
  - `os`
  - `mongoose` — `Types`

## Used by

- `server/index.ts`
- `server/realtime/mediasoupHandlers.ts`
- `server/realtime/webinarEnd.ts`

## Notes

- Security-relevant constructs: `spawn()` (L442), `spawn()` (L798).
