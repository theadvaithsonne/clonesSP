# `server/services/webinarLivekitRecording.ts`

> Module exporting `webinarRoomName`, `startWebinarLivekitRecording`, `stopWebinarLivekitRecording`, `isWebinarLivekitRecording` and 1 more.

**Kind:** backend service · **Lines:** 222

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `webinarRoomName` | function | `webinarRoomName(workshopId: string): string` — Deterministic LiveKit room name for a workshop. | 21 |
| `startWebinarLivekitRecording` | function | `async startWebinarLivekitRecording(workshopId: string, hostUserId: string): Promise<StartWebinarRecordingResult>` — Start a LiveKit Composite Egress for a webinar room. | 39 |
| `stopWebinarLivekitRecording` | function | `async stopWebinarLivekitRecording(workshopId: string): Promise<StartWebinarRecordingResult>` — Stop the currently active webinar egress. | 93 |
| `isWebinarLivekitRecording` | function | `isWebinarLivekitRecording(workshopId: string): boolean` — Whether a webinar room currently has an active LiveKit egress. | 112 |
| `FinalizedRecording` | interface |  | 116 |
| `awaitWebinarRecordingFile` | function | `async awaitWebinarRecordingFile(workshopId: string, egressId: string): Promise<FinalizedRecording \| null>` — Wait for the egress to finalize and produce its file in S3, then: 1. | 142 |

## Interfaces

- **Database (Mongoose models used):**
  - `Workshop` (server/models/workshop.model.ts) — reads: `findById`

## Dependencies

- **Internal:**
  - `server/models/workshop.model.ts` — `Workshop`
  - `server/services/livekit.ts` — `startRoomCompositeEgress`, `stopEgress`, `getActiveEgress`, `clearActiveEgress`, `setRecordingContext`, `getRecordingContext`, `toLivekitRoomName`, `waitForEgressFile`
  - `server/services/s3.ts` — `s3Service`
  - `server/routes/livekitRecording.ts` — `registerDirectS3Recording`
- **Packages:**
  - `mongoose` — `Types`

## Used by

- `server/note-taker/agents/bot-manager.ts`
- `server/realtime/mediasoupHandlers.ts`
