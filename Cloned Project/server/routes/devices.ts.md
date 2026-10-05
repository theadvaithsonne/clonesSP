# `server/routes/devices.ts`

> Express router with 9 endpoints, mounted at `/devices`.

**Kind:** Express router · **Lines:** 394 · **Mounted at:** `/devices` (browser: `/backend/devices`)

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Endpoints (9)

| Method | Router path | Browser path | Middleware | Handler | Line |
|---|---|---|---|---|---|
| POST | `/push-token` | `/backend/devices/push-token` | `requireAuth` | inline | 16 |
| DELETE | `/push-token` | `/backend/devices/push-token` | `requireAuth` | inline | 87 |
| DELETE | `/push-tokens/all` | `/backend/devices/push-tokens/all` | `requireAuth` | inline | 121 |
| POST | `/voip-token` | `/backend/devices/voip-token` | `requireAuth` | inline | 155 |
| DELETE | `/voip-token` | `/backend/devices/voip-token` | `requireAuth` | inline | 218 |
| DELETE | `/voip-tokens/all` | `/backend/devices/voip-tokens/all` | `requireAuth` | inline | 250 |
| POST | `/fcm-token` | `/backend/devices/fcm-token` | `requireAuth` | inline | 284 |
| DELETE | `/fcm-token` | `/backend/devices/fcm-token` | `requireAuth` | inline | 335 |
| DELETE | `/fcm-tokens/all` | `/backend/devices/fcm-tokens/all` | `requireAuth` | inline | 367 |

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `default (router)` | default |  | 393 |

## Interfaces

- **Database (Mongoose models used):**
  - `DeviceToken` (server/models/deviceToken.model.ts) — **writes:** `findOneAndUpdate`, `updateMany`
  - `VoIPToken` (server/models/voipToken.model.ts) — **writes:** `findOneAndUpdate`, `updateMany`
  - `FCMToken` (server/models/fcmToken.model.ts) — **writes:** `findOneAndUpdate`, `updateMany`

## Dependencies

- **Internal:**
  - `server/middleware/auth.ts` — `requireAuth`, `AuthRequest`
  - `server/models/deviceToken.model.ts` — `DeviceToken`
  - `server/models/voipToken.model.ts` — `VoIPToken`
  - `server/models/fcmToken.model.ts` — `FCMToken`
  - `server/services/socket.ts` — `broadcastMobileUserJoined`, `broadcastUserGoneIfUnreachable`
- **Packages:**
  - `express` — `Router`, `Request`, `Response`
  - `zod` — `z`

## Used by

- `server/app.ts`

Entry: mounted in `server/app.ts` at `/devices`.
