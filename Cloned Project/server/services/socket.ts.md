# `server/services/socket.ts`

> Module exporting `setSocketInstance`, `getSocketInstance`, `broadcastMobileUserJoined`, `broadcastUserGoneIfUnreachable` and 6 more.

**Kind:** backend service · **Lines:** 155

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `setSocketInstance` | function | `setSocketInstance(io: Server)` | 9 |
| `getSocketInstance` | function | `getSocketInstance(): Server \| null` | 13 |
| `broadcastMobileUserJoined` | function | `async broadcastMobileUserJoined(userId: string): Promise<void>` — Announce that `userId` is now reachable on mobile (logged in with a push/VoIP token but no live socket). | 24 |
| `broadcastUserGoneIfUnreachable` | function | `async broadcastUserGoneIfUnreachable(userId: string): Promise<void>` — Remove `userId` from the workspace list ONLY if they're no longer reachable anywhere (no active mobile tokens). | 62 |
| `emitNotification` | function | `emitNotification(targetUserId: string, notification: { type: string; title: string; message: strin…)` | 87 |
| `emitLeaveRequestNotification` | function | `emitLeaveRequestNotification(targetUserId: string, notification: { type: "leave_request"; title: string; messa…)` | 103 |
| `emitWorkshopPreviewUpdate` | function | `emitWorkshopPreviewUpdate(orgId: string, event: "workshop:preview:live" \| "workshop:preview:ended", data: { workshopId?: string; meetId?: string; title?: strin…)` — Emit workshop preview event to all users in an organization Used to notify workspace clients when a workshop goes live or ends | 128 |
| `emitAuctionNew` | function | `emitAuctionNew(auction: object)` | 144 |
| `emitAuctionUpdate` | function | `emitAuctionUpdate(auction: object)` | 148 |
| `emitAuctionEnd` | function | `emitAuctionEnd(auction: object)` | 152 |

## Interfaces

- **Database (Mongoose models used):**
  - `User` (server/models/user.model.ts) — reads: `findById`
  - `VoIPToken` (server/models/voipToken.model.ts) — reads: `exists`
  - `DeviceToken` (server/models/deviceToken.model.ts) — reads: `exists`

## Dependencies

- **Internal:**
  - `server/models/user.model.ts` — `User`
  - `server/models/voipToken.model.ts` — `VoIPToken`
  - `server/models/deviceToken.model.ts` — `DeviceToken`
  - `server/services/redis-presence.ts` — `getRedisClient`, `isRedisAvailable`
- **Packages:**
  - `socket.io` — `Server`

## Used by

- `server/realtime/mediasoupHandlers.ts`
- `server/realtime/socket.ts`
- `server/realtime/webinarEnd.ts`
- `server/routes/auction.ts`
- `server/routes/auth.ts`
- `server/routes/betty.ts`
- `server/routes/devices.ts`
- `server/routes/dm.ts`
- `server/routes/events.ts`
- `server/routes/feed.ts`
- `server/routes/garageAdminSupportChats.ts`
- `server/routes/globalDm.ts`
- `server/routes/groups.ts`
- `server/routes/internalChat.ts`
- `server/routes/livekitRecording.ts`
- `server/routes/officeCheckout.ts`
- `server/routes/publicMeet.ts`
- `server/routes/roomBooking.ts`
- `server/routes/slashApprovals.ts`
- `server/routes/slashDeals.ts`
- `server/routes/supportTickets.ts`
- `server/routes/todos.ts`
- `server/routes/userActivity.ts`
- `server/routes/webinarRoutes.ts`
- `server/routes/workshop.ts`
- _…and 13 more_
