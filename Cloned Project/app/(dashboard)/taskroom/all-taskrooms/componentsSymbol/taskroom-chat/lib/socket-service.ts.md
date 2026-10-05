# `app/(dashboard)/taskroom/all-taskrooms/componentsSymbol/taskroom-chat/lib/socket-service.ts`

> Module exporting `socketService`.

**Kind:** Next.js app-directory module (colocated) · **Lines:** 247

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `socketService` | const | `= new ChatSocketService()` | 241 |

## Interfaces

- **Socket.IO events:**
  - listens for: `connect`, `disconnect`, `connect_error`, `reconnect_attempt`, `reconnect`, `reconnect_failed`, `error`
- **Browser storage / cookies:** `auth-token` (localStorage: get), `auth-token` (cookie: get)
- **Timers / queues:** `setTimeout` at L114, L181, L246; `setInterval` at L150
- **External hosts mentioned in the code:** `uatapi.garage.app`

## Dependencies

- **Internal:** none
- **Packages:**
  - `socket.io-client` — `io`, `Socket`
  - `js-cookie`

## Used by

- `app/(dashboard)/taskroom/all-taskrooms/componentsSymbol/taskroom-chat/components/chat/MessageInput.tsx`
- `app/(dashboard)/taskroom/all-taskrooms/componentsSymbol/taskroom-chat/components/chat/MessageList.tsx`
- `app/(dashboard)/taskroom/all-taskrooms/componentsSymbol/taskroom-chat/hooks/useMessages.ts`
- `app/(dashboard)/taskroom/all-taskrooms/componentsSymbol/taskroom-chat/hooks/useOnlineUsers.ts`
- `app/(dashboard)/taskroom/all-taskrooms/componentsSymbol/taskroom-chat/hooks/useTypingUsers.ts`
