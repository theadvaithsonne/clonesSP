# `server/services/livekit.ts`

> Module exporting `toLivekitRoomName`, `generateGuestUid`, `getRoomServiceClient`, `deleteRoom` and 19 more.

**Kind:** backend service · **Lines:** 628

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `toLivekitRoomName` | function | `toLivekitRoomName(spaceId: string): string` — Sanitize a spaceId/channel into a valid LiveKit room name (only A-Z, a-z, 0-9, '-', '_') | 20 |
| `generateGuestUid` | function | `generateGuestUid(): number` — Generate a unique numeric UID for guest users. | 33 |
| `getRoomServiceClient` | function | `getRoomServiceClient(): RoomServiceClient \| null` | 62 |
| `deleteRoom` | function | `async deleteRoom(name: string): Promise<boolean>` — Delete a LiveKit room by name. | 82 |
| `createRoom` | function | `async createRoom(name: string, options?: CreateRoomOptions): Promise<CreateRoomResponse>` — Create a LiveKit room. | 106 |
| `createParticipantToken` | function | `async createParticipantToken(roomName: string, options: CreateParticipantTokenOptions): Promise<string>` — Create a LiveKit participant token (JWT). | 152 |
| `RecordingContext` | interface |  | 193 |
| `setRecordingContext` | function | `setRecordingContext(roomName: string, context: RecordingContext)` | 207 |
| `getRecordingContext` | function | `getRecordingContext(roomName: string)` | 213 |
| `setActiveEgress` | function | `setActiveEgress(roomName: string, egressId: string)` | 222 |
| `getActiveEgress` | function | `getActiveEgress(roomName: string): string \| null` | 226 |
| `clearActiveEgress` | function | `clearActiveEgress(roomName: string)` | 230 |
| `startRoomCompositeEgress` | function | `async startRoomCompositeEgress(roomName: string, opts: { layout?: string; directS3Upload?: boolean; s3KeyPre…): Promise<string \| null>` — Start a room composite egress (recording). | 251 |
| `stopEgress` | function | `async stopEgress(egressId: string): Promise<boolean>` — Stop an active egress (recording). | 349 |
| `EgressFileInfo` | interface |  | 363 |
| `waitForEgressFile` | function | `async waitForEgressFile(egressId: string, timeoutMs = 30 * 60_000, intervalMs = 3_000): Promise<EgressFileInfo \| null>` — Poll the egress until it's COMPLETE (or fails / times out) and return the resulting file's S3 key. | 379 |
| `getLivekitUrl` | function | `getLivekitUrl(): string` — Get the LiveKit server URL (for clients to connect to) | 426 |
| `getAudiencePreviewCount` | function | `async getAudiencePreviewCount(roomName: string): Promise<number>` — Count participants in a LiveKit room whose identity starts with "audience-". | 435 |
| `countWebinarParticipants` | function | `async countWebinarParticipants(roomName: string): Promise<number \| null>` — How many REAL participants a webinar's LiveKit room still has — everyone except preview-card audience and the note-taker bot. | 459 |
| `getWebinarViewerCount` | function | `async getWebinarViewerCount(roomName: string, hostUserId: string): Promise<number>` — Count active viewers in a webinar LiveKit room, excluding: - The host (matched by hostUserId) - Preview-card audience members (identity starts with "audience-") Returns 0 if the room doesn't exist or the API call fails. | 482 |
| `setParticipantPublishGrant` | function | `async setParticipantPublishGrant(roomName: string, identity: string, canPublish: boolean): Promise<boolean>` — Atomically update a participant's publish/subscribe permissions in an already-joined room. | 510 |
| `setParticipantPublishSources` | function | `async setParticipantPublishSources(roomName: string, identity: string, sources: TrackSource[]): Promise<boolean>` — Update the fine-grained per-source publish allowlist for a joined participant. | 545 |
| `ConferencePolicy` | interface |  | 588 |
| `setConferencePolicy` | function | `setConferencePolicy(roomName: string, policy: ConferencePolicy)` | 596 |
| `getConferencePolicy` | function | `getConferencePolicy(roomName: string): ConferencePolicy \| null` | 602 |
| `policyToSources` | function | `policyToSources(policy: ConferencePolicy \| null): TrackSource[] \| null` — Given a policy, return the LiveKit source allowlist for a NON-host joiner. | 612 |
| `TrackSource` | export |  | 627 |

## Interfaces

- **Environment variables (`process.env`):** `LIVEKIT_API_KEY`, `LIVEKIT_API_SECRET`, `LIVEKIT_URL`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_S3_BUCKET`, `AWS_S3_REGION`, `AWS_S3_FORCE_PATH_STYLE`, `AWS_S3_ENDPOINT`
- **Timers / queues:** `setTimeout` at L41, L210, L419, L440, L464, …

## Dependencies

- **Internal:** none
- **Packages:**
  - `livekit-server-sdk` — `AccessToken`, `RoomServiceClient`, `EgressClient`, `EncodedFileOutput`, `EncodedFileType`, `S3Upload`, …

## Used by

- `server/note-taker/agents/bot-manager.ts`
- `server/realtime/mediasoupHandlers.ts`
- `server/realtime/socket.ts`
- `server/realtime/webinarEnd.ts`
- `server/routes/livekitRecording.ts`
- `server/routes/meet.ts`
- `server/routes/publicEvents.ts`
- `server/routes/publicMeet.ts`
- `server/routes/webinarRoutes.ts`
- `server/routes/workshopPreview.ts`
- `server/services/jobs.ts`
- `server/services/webinarLivekitRecording.ts`
