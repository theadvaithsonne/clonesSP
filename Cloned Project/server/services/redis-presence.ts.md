# `server/services/redis-presence.ts`

> Module exporting `initRedisClients`, `getRedisClient`, `getRedisPub`, `getRedisSub` and 1 more.

**Kind:** backend service · **Lines:** 402

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `initRedisClients` | function | `initRedisClients()` | 26 |
| `getRedisClient` | function | `getRedisClient(): Redis \| null` | 94 |
| `getRedisPub` | function | `getRedisPub(): Redis \| null` | 98 |
| `getRedisSub` | function | `getRedisSub(): Redis \| null` | 102 |
| `isRedisAvailable` | function | `isRedisAvailable(): boolean` | 107 |
| `WorkspacePresenceService` | class |  | 111 |

## Interfaces

- **Environment variables (`process.env`):** `REDIS_URL`

## Dependencies

- **Internal:** none
- **Packages:**
  - `ioredis`

## Used by

- `server/realtime/socket.ts`
- `server/routes/auth.ts`
- `server/services/call-state.ts`
- `server/services/socket.ts`
