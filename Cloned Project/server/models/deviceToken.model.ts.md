# `server/models/deviceToken.model.ts`

> Mongoose model that stores Expo push tokens registered by the mobile apps (and web), one row per token, with the app and feature flags that decide which pushes it receives.

**Kind:** Mongoose model · **Lines:** 99

## Purpose
The mobile apps (garage-chat and NetworkChains) register an Expo push token with the backend after login. `server/services/pushNotification.ts` reads these rows to decide which devices get knock/call pushes, chat-message pushes and wallet money pushes. Direct FCM tokens (`fcmToken.model.ts`) and iOS VoIP tokens are kept in separate collections.

## How it works
Fields (interface `IDeviceToken`):
- `userId` (ObjectId ref `User`, required, indexed) and `token` (required, **globally unique**, so a token re-registered under another account moves to that account instead of being duplicated).
- `platform`: `"ios" | "android" | "web"` (required). `deviceId` and `appVersion` are optional strings.
- `app`: `"garage-chat" | "networkchain"`. If absent, the row predates the field and is treated as garage-chat. The audience filter in `pushNotification.ts` sends knock/call pushes to garage-chat only, message pushes (DM, group, mention) to garage-chat **and** NetworkChains, and wallet money pushes to every app.
- `features`: string array, default `undefined`. The app re-sends it on every registration, so a build that stops advertising a feature loses it on its next launch. The schema comment documents `"native-chat"` (an Android build that draws chat notifications itself, so chat pushes go to it data-only). `pushNotification.ts` also checks other feature values, such as a native-calls flag.
- `isActive` (default `true`), `lastUsedAt` (default now), `failedAttempts` (default 0), `lastFailedAt`. These let the push service retire tokens that keep failing.
- `timestamps: true`.

Indexes:
- `{ userId: 1, isActive: 1 }` for "active tokens of user X" lookups.
- A TTL index on `lastUsedAt` with `expireAfterSeconds` of 90 days. MongoDB deletes a token automatically once it has gone 90 days without `lastUsedAt` being refreshed.

The model is registered with the `mongoose.models.DeviceToken ||` guard.

## Exports
- `IDeviceToken` - the document interface.
- `DeviceToken` - the Mongoose model (default collection `devicetokens`).

## Interfaces
- **Database:** `DeviceToken` (collection `devicetokens`) - written by device registration, read and updated (failure counts, deactivation) by the push services.

## Dependencies
- **Packages:** `mongoose`.

## Used by
- `server/routes/devices.ts` (mounted at `/devices`): `POST /backend/devices/push-token`, `DELETE /backend/devices/push-token`, `DELETE /backend/devices/push-tokens/all`.
- `server/services/pushNotification.ts` - audience filtering and sending.
- `server/realtime/socket.ts` and `server/services/socket.ts`.
- Manual scripts that read this collection in the **production** database: `scripts/inspect-push-tokens.ts`, `scripts/test-commission-push.ts`, `scripts/test-knock-push.ts`, `scripts/test-transfer-push.ts`.

## Notes
- The TTL index deletes rows outright. If a device is never seen for 90 days it has to register its token again.
