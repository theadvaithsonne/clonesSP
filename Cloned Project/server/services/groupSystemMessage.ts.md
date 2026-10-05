# `server/services/groupSystemMessage.ts`

> src/services/groupSystemMessage.ts

**Kind:** backend service · **Lines:** 210

<!-- docgen:auto -->

## Purpose
src/services/groupSystemMessage.ts

"Priya added Devon" — the centred pills in a group thread.

Written as ordinary GroupMessage rows carrying `type: "system"`, so they
arrive on the EXISTING `group:message` socket event and page through the
existing message routes. No new event, no new endpoint.

Two rules make them safe for clients that predate them:

  1. `text` is pre-rendered server-side. A client that knows nothing about
     `type`/`event` still has a human-readable line to show.
  2. They must never affect unread counts, previews, or pushes. Unread is
     computed from `lastReadAt` vs message time, so a system row WOULD
     otherwise inflate the badge — callers filter on `type: { $ne: "system" }`
     at those three sites (see groups.ts /unread/all and /last-messages). […]

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `SystemMessageMeta` | interface | Extra context some events need to render their sentence. | 27 |
| `SystemMessageTaskroom` | interface | Where a Taskroom pill points, stored on the message so the client can open the board. | 44 |
| `writeGroupSystemMessage` | function | `async writeGroupSystemMessage(opts: { groupId: string \| Types.ObjectId; event: SystemEven…): Promise<void>` — Write a system pill and broadcast it to the group room. | 131 |

## Interfaces

- **Socket.IO events:**
  - emits: `group:message`
- **Database (Mongoose models used):**
  - `User` (server/models/user.model.ts) — reads: `find`
  - `GroupMessage` (server/models/groupMessage.model.ts) — **writes:** `create`

## Dependencies

- **Internal:**
  - `server/models/groupMessage.model.ts` — `GroupMessage`, `SystemEvent`
  - `server/models/user.model.ts` — `User`
  - `server/services/socket.ts` — `getSocketInstance`
- **Packages:**
  - `mongoose` — `Types`

## Used by

- `server/routes/groups.ts`
- `server/services/__tests__/groupTaskroom.test.ts`
- `server/services/groupTaskAuto.ts`
- `server/services/groupTaskManual.ts`
- `server/services/groupTaskRemoval.ts`
- `server/services/groupTaskroom.ts`
