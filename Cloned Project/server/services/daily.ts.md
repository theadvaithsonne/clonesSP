# `server/services/daily.ts`

> Module exporting `toDailyRoomName`, `generateGuestUid`, `deleteRoom`, `createRoom` and 5 more.

**Kind:** backend service · **Lines:** 293

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `toDailyRoomName` | function | `toDailyRoomName(spaceId: string): string` — Sanitize a spaceId/channel into a valid Daily.co room name (only A-Z, a-z, 0-9, '-', '_') | 5 |
| `generateGuestUid` | function | `generateGuestUid(): number` — Generate a unique numeric UID for guest users. | 19 |
| `deleteRoom` | function | `async deleteRoom(name: string): Promise<boolean>` — Delete a Daily.co room by name. | 64 |
| `createRoom` | function | `async createRoom(name: string, options?: CreateRoomOptions): Promise<CreateRoomResponse>` | 109 |
| `setRecordingContext` | function | `setRecordingContext(roomName: string, context: { organizationId: string; userId: string; meetingT…)` | 187 |
| `getRecordingContext` | function | `getRecordingContext(roomName: string)` | 198 |
| `getRecordingDownloadLink` | function | `async getRecordingDownloadLink(recordingId: string): Promise<string \| null>` — Get a temporary download link for a Daily.co cloud recording. | 205 |
| `listRecordings` | function | `async listRecordings(roomName?: string): Promise<any[]>` — List recordings for a room. | 229 |
| `createMeetingToken` | function | `async createMeetingToken(roomName: string, options: CreateMeetingTokenOptions): Promise<string>` | 250 |

## Interfaces

- **External HTTP calls:**
  - `DELETE api.daily.co/rooms/${name}` (L71)
  - `GET api.daily.co/rooms/${name}` (L95)
  - `POST api.daily.co/rooms` (L128)
  - `POST api.daily.co/rooms/${name}` (L146)
  - `GET api.daily.co/recordings/${recordingId}/access-link` (L209)
  - `POST api.daily.co/meeting-tokens` (L271)
- **Environment variables (`process.env`):** `DAILY_API_KEY`
- **Timers / queues:** `setTimeout` at L27, L195
- **External hosts mentioned in the code:** `api.daily.co`

## Dependencies

- **Internal:** none
- **Packages:** none

## Used by

- `server/routes/dailyWebhook.ts`
