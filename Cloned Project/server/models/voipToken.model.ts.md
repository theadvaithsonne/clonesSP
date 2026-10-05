# `server/models/voipToken.model.ts`

> Mongoose model `VoIPToken` (collection `voiptokens`) with 10 top-level fields.

**Kind:** Mongoose model · **Lines:** 80

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Model `VoIPToken`

- **Collection:** `voiptokens` (default pluralised name)
- **Schema options:** `timestamps: true`

| Field | Type | Flags |
|---|---|---|
| `userId` | `Schema.Types.ObjectId` | required, index, ref "User" |
| `token` | `String` | required, unique |
| `platform` | `String` | required, default "ios", enum ["ios"] |
| `deviceId` | `String` | — |
| `appVersion` | `String` | — |
| `app` | `String` | enum ["garage-chat", "networkchain"] |
| `isActive` | `Boolean` | default true |
| `lastUsedAt` | `Date` | default Date.now |
| `failedAttempts` | `Number` | default 0 |
| `lastFailedAt` | `Date` | — |

### Indexes

- `{ userId: 1, isActive: 1 }` (L69)
- `{ lastUsedAt: 1 }, { expireAfterSeconds: 90 * 24 * 60 * 60 }` (L72)

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `IVoIPToken` | interface |  | 3 |
| `VoIPToken` | const | `= mongoose.models.VoIPToken \|\| mongoose.model<IVoIPToken>("VoIPToken", VoIPTokenSchema)` | 77 |

## Interfaces

None detected: no endpoints, events, data access or environment reads were found.

## Dependencies

- **Internal:** none
- **Packages:**
  - `mongoose` — `Schema`, `Document`, `Types`

## Used by

- `scripts/test-knock-push.ts`
- `server/realtime/socket.ts`
- `server/routes/devices.ts`
- `server/services/socket.ts`
- `server/services/voipPushNotification.ts`
