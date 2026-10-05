# `server/models/fcmToken.model.ts`

> Mongoose model for native Firebase Cloud Messaging (FCM) device tokens, used to wake Android apps with data-only knock-call pushes even when the app has been killed.

**Kind:** Mongoose model · **Lines:** 81

## Purpose
Expo push tokens (`deviceToken.model.ts`) go through Expo's servers, and Expo's API cannot send the data-only FCM message needed to wake the app's custom `FirebaseMessagingService` so a call rings while the app is killed. The Android app therefore also registers its native FCM token, stored here, and the backend sends to it directly with `firebase-admin`. iOS uses VoIP push instead and has its own token collection.

## How it works
Fields (`IFCMToken`):
- `userId` (ref `User`, required, indexed) and `token` (required, globally unique).
- `platform`: enum `["android"]`, default and required. This path is Android-only.
- `deviceId` and `appVersion` (optional).
- `isActive` (default true), `lastUsedAt` (default now), `failedAttempts` (default 0), `lastFailedAt`.
- Timestamps are on.

Indexes:
- `{ userId, isActive }` for active-token lookups.
- A TTL index on `lastUsedAt` (90 days), the same policy as the VoIP tokens. A token unused for 90 days is deleted by MongoDB.

Registered behind a `mongoose.models.FCMToken ||` guard.

## Exports
- `IFCMToken` - interface.
- `FCMToken` - the model (default collection `fcmtokens`).

## Interfaces
- **Database:** `FCMToken` (collection `fcmtokens`).
- **External services:** Firebase Cloud Messaging, through `firebase-admin` in `fcmPushNotification.ts`.

## Dependencies
- **Packages:** `mongoose`.

## Used by
- `server/routes/devices.ts` (mounted at `/devices`): `POST /backend/devices/fcm-token`, `DELETE /backend/devices/fcm-token`, `DELETE /backend/devices/fcm-tokens/all`.
- `server/services/fcmPushNotification.ts` - sends the data-only call pushes and tracks failures.
- `server/realtime/socket.ts` - triggers call pushes on knock.

## Notes
- The TTL deletes rows outright. An Android device that has not refreshed its token in 90 days stops ringing in killed state until the app registers again.
