# `server/services/call-state.ts`

> Module exporting `CallStateService`, `callStateService`.

**Kind:** backend service · **Lines:** 247

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `CallStateService` | class |  | 14 |
| `callStateService` | const | `= new CallStateService()` | 246 |

## Interfaces

None detected: no endpoints, events, data access or environment reads were found.

## Dependencies

- **Internal:**
  - `server/services/redis-presence.ts` — `getRedisClient`, `isRedisAvailable`
- **Packages:** none

## Used by

- `server/realtime/socket.ts`
