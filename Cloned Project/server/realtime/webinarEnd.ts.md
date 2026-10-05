# `server/realtime/webinarEnd.ts`

> Module exporting `announceWebinarEnded`, `dropLivekitRoom`, `endWebinarSession`.

**Kind:** Socket.IO / realtime · **Lines:** 149

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `announceWebinarEnded` | function | `announceWebinarEnded(webinarId: string, io: Server \| null = getSocketInstance()): void` — Tell everyone in the room the session is over and stop what is running. | 33 |
| `dropLivekitRoom` | function | `dropLivekitRoom(webinarId: string): void` — Tear the media room down too. | 64 |
| `EndSessionOptions` | interface |  | 70 |
| `endWebinarSession` | function | `async endWebinarSession(webinarId: string, opts: EndSessionOptions): Promise<void>` — The full stop: announce to the room, mark the Meet and the session row ended, free the host seat, drop persisted live state, and remove the room. | 81 |

## Interfaces

- **Socket.IO events:**
  - emits: `webinar:recordingStopped`, `webinar:webinarEnded`
- **Database (Mongoose models used):**
  - `Workshop` (server/models/workshop.model.ts) — reads: `findById`; **writes:** `updateOne`
  - `Meet` (server/models/meet.model.ts) — **writes:** `findByIdAndUpdate`
  - `WorkshopSessionOverride` (server/models/workshopSessionOverride.model.ts) — **writes:** `findOneAndUpdate`

## Dependencies

- **Internal:**
  - `server/services/socket.ts` — `emitWorkshopPreviewUpdate`, `getSocketInstance`
  - `server/services/mediasoup.ts` — `getRoom`, `removeRoom`
  - `server/services/webinarRecording.ts` — `isRecording as isServerRecording`, `stopServerRecording`
  - `server/services/livekit.ts` — `deleteRoom`, `toLivekitRoomName`
  - `server/services/webinarLiveState.ts` — `clearLiveState`
  - `server/services/webinarHost.ts` — `releaseSessionHost`, `resolveSessionAnchor`
  - `server/models/workshop.model.ts` — `Workshop`
  - `server/models/meet.model.ts` — `Meet`
  - `server/models/workshopSessionOverride.model.ts` — `WorkshopSessionOverride`
  - `server/note-taker/agents/bot-manager.ts` — `BotManager`
- **Packages:**
  - `mongoose`
  - `socket.io` — `Server`

## Used by

- `server/realtime/mediasoupHandlers.ts`
- `server/routes/webinarRoutes.ts`
