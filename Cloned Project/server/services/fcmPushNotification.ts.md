# `server/services/fcmPushNotification.ts`

> src/services/fcmPushNotification.ts

**Kind:** backend service · **Lines:** 276

<!-- docgen:auto -->

## Purpose
src/services/fcmPushNotification.ts

Direct FCM sender for Android knock-call delivery.

Why direct FCM instead of Expo Push: Expo's API always sets the FCM
`notification` field on the outgoing message, which Android delivers as a
system banner when the app is killed — your code never runs. We need a
data-only message (`data` field only, no `notification`) so FCM dispatches
to our custom FirebaseMessagingService, which then synthesizes the
full-screen incoming-call UI via CallNotificationHelper.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `sendKnockFCMPush` | function | `async sendKnockFCMPush(recipientId: string, payload: FCMKnockPayload, targeting?: KnockPushTargeting): Promise<SendFCMResult>` — Send a data-only knock message to all of a user's registered FCM tokens. | 131 |
| `sendKnockCancelFCMPush` | function | `async sendKnockCancelFCMPush(recipientId: string, knockerId: string, targeting?: KnockPushTargeting): Promise<SendFCMResult>` — Send a data-only cancel message — dismisses a ringing native call UI when the knock was answered/declined on another device or cancelled by the knocker. | 220 |

## Interfaces

- **Database (Mongoose models used):**
  - `FCMToken` (server/models/fcmToken.model.ts) — reads: `find`; **writes:** `findOneAndUpdate`
- **Environment via `server/config/env.ts`:** `env.FIREBASE_SERVICE_ACCOUNT_JSON`, `env.FIREBASE_SERVICE_ACCOUNT_PATH`

## Dependencies

- **Internal:**
  - `server/config/env.ts` — `env`
  - `server/models/fcmToken.model.ts` — `FCMToken`
  - `server/services/voipPushNotification.ts` — `KnockPushTargeting`, `(types only)`
- **Packages:**
  - `fs`

## Used by

- `server/realtime/socket.ts`
