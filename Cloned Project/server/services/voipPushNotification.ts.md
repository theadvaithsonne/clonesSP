# `server/services/voipPushNotification.ts`

> Module exporting `sendVoIPPushToUser`, `sendKnockVoIPPush`, `sendKnockVoIPCancelPush`, `shutdownVoIPProvider`.

**Kind:** backend service · **Lines:** 387

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `KnockPushTargeting` | interface | Per-device targeting for knock pushes. | 32 |
| `sendVoIPPushToUser` | function | `async sendVoIPPushToUser(userId: string, payload: VoIPPushPayload, targeting?: KnockPushTargeting): Promise<SendVoIPResult>` — Send VoIP push notification to a user's iOS devices | 166 |
| `sendKnockVoIPPush` | function | `async sendKnockVoIPPush(recipientId: string, knockerId: string, knockerName: string, knockerProfilePicture?: string, targeting?: KnockPushTargeting): Promise<SendVoIPResult>` — Send VoIP push notification for knock request This shows the native iOS call UI even when app is terminated | 272 |
| `sendKnockVoIPCancelPush` | function | `async sendKnockVoIPCancelPush(recipientId: string, knockerId: string, targeting?: KnockPushTargeting): Promise<SendVoIPResult>` — Send a VoIP cancel push — stops a ringing CallKit UI when the knock was answered/declined on another device or cancelled by the knocker. | 308 |
| `shutdownVoIPProvider` | function | `shutdownVoIPProvider(): void` — Shutdown the APNs provider (call on server shutdown) | 380 |

## Interfaces

- **Database (Mongoose models used):**
  - `VoIPToken` (server/models/voipToken.model.ts) — reads: `find`; **writes:** `findOneAndUpdate`
  - `User` (server/models/user.model.ts) — reads: `findById`
- **Environment via `server/config/env.ts`:** `env.APNS_KEY_ID`, `env.APNS_TEAM_ID`, `env.APNS_KEY_CONTENT`, `env.APNS_KEY_PATH`, `env.APNS_PRODUCTION`, `env.NETWORKCHAIN_APNS_BUNDLE_ID`, `env.APNS_BUNDLE_ID`

## Dependencies

- **Internal:**
  - `server/config/env.ts` — `env`
  - `server/models/voipToken.model.ts` — `VoIPToken`
  - `server/models/user.model.ts` — `User`
- **Packages:**
  - `@parse/node-apn`
  - `fs`

## Used by

- `server/realtime/socket.ts`
- `server/services/fcmPushNotification.ts`
