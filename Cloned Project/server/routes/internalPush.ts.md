# `server/routes/internalPush.ts`

> Service-to-service push for NetworkChains.

**Kind:** Express router · **Lines:** 95 · **Mounted at:** `/internal/push` (browser: `/backend/internal/push`)

<!-- docgen:auto -->

## Purpose
Service-to-service push for NetworkChains.

contacts-backend owns signals and opportunities but has no push
infrastructure — this backend is the only push sender (DeviceToken lives
here). It calls this route whenever a user gets a new signal or opportunity.

Auth: `X-Internal-Api-Key: <INTERNAL_API_KEY>` — the key contacts-backend
already holds as GARAGE_HQ_INTERNAL_API_KEY for /wallet/hq.

The audience is pinned to "networkchain": the screens these pushes open
exist only in the NetworkChains app, so no other app's tokens are reached.

Every push here is an alert (`nativeAlert`): the contact's photo or the
product's image (`image`) is drawn in the icon slot with the app badge in
its corner — natively on Android "native-alerts" builds and by the iOS
Notification Service Extension; older Android builds show it as the large […]

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Endpoints (1)

| Method | Router path | Browser path | Middleware | Handler | Line |
|---|---|---|---|---|---|
| POST | `/user` | `/backend/internal/push/user` | `requireInternalKey` | inline | 66 |

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `default (router)` | default |  | 94 |

## Interfaces

None detected: no endpoints, events, data access or environment reads were found.

## Dependencies

- **Internal:**
  - `server/middleware/auth.ts` — `requireInternalKey`
  - `server/services/pushNotification.ts` — `sendPushToUser`
- **Packages:**
  - `express` — `Router`, `Request`, `Response`
  - `mongoose`

## Used by

- `server/app.ts`

Entry: mounted in `server/app.ts` at `/internal/push`.
