# `app/(dashboard)/flowboard/lib/board-socket-service.ts`

> A singleton Socket.IO client for one Flowboard board: connects to the external Flowboard server's `/boards` namespace, applies task updates/deletes to the task store, reconnects manually, and fans every event out to a small in-house listener registry.

**Kind:** Next.js app-directory module (colocated) · **Lines:** 297

## Purpose
Flowboard boards are edited collaboratively, so the board page needs live updates (cards, stages, checklists, comments, tags, members) from other users. The Flowboard backend is a separate service at `https://uatapi.garage.app` with its own Socket.IO server; it is not this repo's `server/realtime/socket.ts`. This module wraps that connection in one shared object so many components can subscribe to board events without each opening a socket, and so the connection survives component re-renders.

## How it works

### State
The `BoardSocketService` class exposes public fields `socket`, `connected`, `connecting`, `reconnecting`, `error` and `socketId`, and keeps private `listeners` (a `Map<event, Set<handler>>`), `reconnectTimeout`, `userId` and `boardId`. `SOCKET_URL` is hard-coded to `https://uatapi.garage.app` (a comment suggests an env var, but none is used).

### `connect(userId, boardId)` (L22-L210)
- Returns immediately if a socket is already connected and not reconnecting.
- Remembers `userId`/`boardId` (needed for reconnects), tears down any previous socket (`removeAllListeners` + `disconnect`) and clears a pending reconnect timer.
- Opens `io("https://uatapi.garage.app/boards", { path: "/flowboard/socket/", transports: ["websocket","polling"], timeout: 10000, forceNew: true, query: { userId, boardId }, reconnection: false, ... })`. Built-in reconnection is off; the other reconnection options passed have no effect.
- Built-in handlers:
  - `connect` - sets flags, notifies `"connected"`.
  - `your-id` - the server sends this socket's id; stored as `socketId` and forwarded. Components send this id with REST writes so the server can skip echoing the change back to the sender.
  - `comment:updated` / `comment:deleted` - log only.
  - `task:updated` - takes `payload.data || payload` and, if it has `_id`, calls `useTaskStore.getState().updateTaskFromSocket(...)`.
  - `task:deleted` - extracts the id from `payload.taskRecordExist.data._id`, falling back to `payload.data._id`, `payload._id`, or the payload itself, then calls `useTaskStore.getState().deleteTaskFromSocket(id)`.
  - `disconnect` - clears flags and `socketId`; unless the reason is `"io client disconnect"` (a deliberate disconnect) it marks `reconnecting`, notifies `"disconnected"` (and `"reconnecting"` if it was connected) and schedules a reconnect.
  - `connect_error` - records the message, notifies, schedules a reconnect.
  - `reconnect_attempt`, `reconnect`, `reconnect_failed`, `error` - update flags and notify (the first three are socket.io's built-in reconnection events and rarely fire with `reconnection: false`).
  - `onAny` - forwards every server event to registered listeners. Because of this, events with explicit handlers above (e.g. `task:updated`) are also delivered to listeners.
- Commented-out handlers for `task:created`, `checklist:created` and `checklist:deleted` show those were moved into components.

### `disconnect()` (L212-L230)
Clears the reconnect timer, removes listeners from and closes the socket, and resets all flags. Registered `on()` listeners are kept, so components that stay mounted keep working after a later `connect`.

### Manual reconnect (`scheduleReconnect`, L232-L255)
Skips if a timer is pending or the socket is connecting/connected. Otherwise waits `delayMs` (3000 ms by default, 2000 ms after `reconnect_failed`) and, if still disconnected and a `userId`/`boardId` is known, calls `connect` again with a fresh socket. Retries repeat indefinitely at a fixed delay (no backoff).

### Listener registry
- `on(event, handler)` adds to the set; `off(event, handler?)` removes one handler or all handlers for the event.
- `notifyListeners` calls each handler in a try/catch so one bad listener cannot break others.
- Synthetic events emitted to listeners: `connected`, `disconnected`, `reconnecting`, `connect_error`, `reconnect_attempt`, `reconnect`, `reconnect_failed`, `error`, plus every raw server event via `onAny`.
- `emit(event, data?)` sends only when connected; otherwise it logs a warning and drops the message.

## Exports
- `boardSocketService` - the single `BoardSocketService` instance (the class itself is not exported).

## Interfaces
- **Socket.IO events:** connects to namespace `/boards` (path `/flowboard/socket/`, query `userId`, `boardId`). Handles `your-id`, `task:updated`, `task:deleted`, `comment:updated`, `comment:deleted` directly. Components subscribe through `on()` to, among others, `task:created`, `card:created/updated/deleted`, `stage:created/updated/deleted`, `checklist:created/updated/deleted`, `comment:created/updated/deleted`, `tag:created/updated/deleted` and `member:created`.
- **External services:** Flowboard real-time server at `https://uatapi.garage.app`.
- **Background work:** a `setTimeout`-based reconnect loop while disconnected.

## Dependencies
- **Internal:** `store/flowboard/taskStore.ts` - `updateTaskFromSocket`, `deleteTaskFromSocket`; `store/flowboard/checklistStore.ts` - imported for the commented-out checklist handlers (currently unused).
- **Packages:** `socket.io-client` - `io`, `Socket`.

## Used by
- `app/(dashboard)/flowboard/[symbol]/page.tsx` - calls `connect(userId, boardId)` on mount and `disconnect()` on unmount.
- `app/(dashboard)/flowboard/lib/use-board-socket-status.ts` - status hook.
- `app/(dashboard)/flowboard/[symbol]/components/kanban-board.tsx`, `card-modal.tsx`, `card-activity.tsx`, `share-modal.tsx` - subscribe to board events.
- `store/flowboard/cardStore.ts`.

## Notes
- Only one board can be connected at a time; calling `connect` for another board while connected is ignored until `disconnect` runs (the page does that on unmount).
- Leftover debug logging, e.g. `console.log('234234345345', payload)` on `your-id`.
- The `userId` sent in the query comes from an unverified client-side decode of the JWT; any access control must happen on the Flowboard server.
