# `server/services/channelMembership.ts`

> Module exporting `getUserChannelIds`, `invalidateUserChannelIds`.

**Kind:** backend service · **Lines:** 54

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `getUserChannelIds` | function | `async getUserChannelIds(userId: string, orgId: string): Promise<string[]>` | 25 |
| `invalidateUserChannelIds` | function | `invalidateUserChannelIds(userId: string, orgId: string): void` — Invalidate the cached channel list for a specific (user, org) pair. | 51 |

## Interfaces

- **Database (Mongoose models used):**
  - `ChannelMembership` (server/models/channelMembership.model.ts) — reads: `find`

## Dependencies

- **Internal:**
  - `server/models/channelMembership.model.ts` — `ChannelMembership`
- **Packages:** none

## Used by

- `server/routes/course.ts`
- `server/routes/service.ts`
