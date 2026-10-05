# `server/services/mediasoup.ts`

> Module exporting `createWorker`, `getOrCreateRoom`, `getRoom`, `removeRoom` and 1 more.

**Kind:** backend service · **Lines:** 305

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `WebinarPeer` | interface |  | 6 |
| `PinnedItemType` | type |  | 38 |
| `PinnedProductSnapshot` | interface |  | 48 |
| `VirtualPeer` | interface |  | 74 |
| `WebinarRoom` | interface |  | 85 |
| `rooms` | const | `= new Map<string, WebinarRoom>()` — Map of webinarId -> WebinarRoom | 160 |
| `createWorker` | function | `async createWorker(): Promise<any>` | 167 |
| `getOrCreateRoom` | function | `async getOrCreateRoom(webinarId: string): Promise<WebinarRoom>` | 190 |
| `getRoom` | function | `getRoom(webinarId: string): WebinarRoom \| undefined` | 233 |
| `removeRoom` | function | `removeRoom(webinarId: string): void` | 237 |
| `createWebRtcTransport` | function | `async createWebRtcTransport(router: any): Promise<{ transport: any; params: { id: string; i…` | 267 |
| `createMediasoupWorker` | export | `(local createWorker)` | 304 |

## Interfaces

- **Timers / queues:** `setTimeout` at L181

## Dependencies

- **Internal:**
  - `server/config/mediasoup.ts` — `mediasoupConfig`
- **Packages:**
  - `mediasoup`

## Used by

- `server/index.ts`
- `server/realtime/mediasoupHandlers.ts`
- `server/realtime/webinarEnd.ts`
- `server/routes/livekitRecording.ts`
- `server/routes/publicWebinar.ts`
- `server/routes/webinarRoutes.ts`
- `server/routes/workshopPreview.ts`
- `server/services/webinarLiveState.ts`
- `server/services/webinarRecording.ts`
