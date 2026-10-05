# `components/athena/socket/timeTrack-socket-service.ts`

> A singleton Socket.IO client that connects to the external Taskroom v2 `/tasks` namespace for one task card, keeps a client-side listener registry and reconnects itself by hand.

**Kind:** Socket client service (hinted as React component) · **Lines:** 284

## Purpose
Athena's task-card modal needs real-time updates scoped to one task (comments, checklist and task changes) from the Taskroom backend. That backend is an external service at `https://uatapi.garage.app`, not this repo's Socket.IO server. The file wraps a `socket.io-client` connection in a class and exports one shared instance. Callers can subscribe to events through its own `on`/`off` API, and read the server-assigned `socketId`, which the card modal sends with mutations so the server can skip echoing the change back to the client that made it.

The class is a near copy of the Athena "board socket" service: its log messages still say `[Board Socket]` / `[BoardSocket]`, and the `boardId` field actually holds a task ID.

## How it works
- **`connect(userId, boardId)`** (L21-L194)
  - Does nothing if a socket is already connected and not reconnecting.
  - Stores `userId` and `boardId`, tears down any previous socket (`removeAllListeners` + `disconnect`) and clears any pending reconnect timer.
  - Opens `io("https://uatapi.garage.app/tasks", { path: "/taskroomv2/socket/", transports: ["websocket","polling"], timeout: 10000, forceNew: true, query: { userId, taskId: boardId }, reconnection: false, ... })`. Built-in reconnection is turned off, so the reconnection options passed alongside it have no effect. Reconnection is done by hand (below).
  - Socket handlers:
    - `connect` sets the `connected` flag and notifies `"connected"`.
    - `your-id` stores the payload as `socketId` (with a leftover debug `console.log`) and notifies `"your-id"`.
    - `comment:updated`, `comment:deleted`, `task:updated`, `task:deleted` are only logged. The store-update calls (`useTaskStore`, `useChecklistStore`) are commented out, as are the `comment:created`, `task:created`, `checklist:created` and `checklist:deleted` handlers.
    - `disconnect` resets state. For any reason other than `"io client disconnect"` it marks itself reconnecting, notifies `"disconnected"` (and `"reconnecting"` if it was connected), then calls `scheduleReconnect()`.
    - `connect_error` records `error`, notifies, then schedules a reconnect.
    - `reconnect_attempt`, `reconnect`, `reconnect_failed` (schedules a reconnect after 2 s) and `error` update the flags and notify. The `reconnect*` events belong to the Manager in socket.io-client v4 and will not fire on the socket, especially with reconnection off.
    - `onAny` passes every incoming server event on to the registered listeners, so subscribers receive all events, including the ones logged above.
- **`disconnect()`** (L196-L214) clears the reconnect timer, removes listeners, disconnects and resets every flag. It does not clear `userId`/`boardId`, but a pending reconnect has already been cancelled.
- **`scheduleReconnect(delayMs = 3000)`** (private, L216-L239) is skipped if a timer is pending or the socket is connecting or connected. Otherwise, after the delay, if still disconnected and IDs are known, it destroys the old socket and calls `connect` again.
- **Listener registry:** `on(event, handler)` adds the handler to a `Map<string, Set>`. `off(event, handler?)` removes one handler, or all handlers for the event. `notifyListeners` calls each handler inside try/catch so one failing handler cannot break the others.
- **`emit(event, data?)`** sends only when connected, otherwise logs a warning (the event is dropped, not queued).

## Exports
- `timeSocketService` - the single shared `TimeSocketService` instance. Public members: `socket`, `connected`, `connecting`, `reconnecting`, `error`, `socketId`, `connect(userId, boardId)`, `disconnect()`, `on(event, handler)`, `off(event, handler?)`, `emit(event, data?)`.
- The `TimeSocketService` class itself is not exported.

## Interfaces
- **Socket.IO events:** listens for `connect`, `your-id`, `comment:updated`, `comment:deleted`, `task:updated`, `task:deleted`, `disconnect`, `connect_error`, `error` (plus `reconnect*`, see above) and every other event through `onAny`. Emits nothing itself; callers emit through `emit()`. Local listener events it raises: `connected`, `your-id`, `disconnected`, `reconnecting`, `connect_error`, `reconnect_attempt`, `reconnect`, `reconnect_failed`, `error`, plus every server event.
- **External services:** Taskroom v2 Socket.IO server at `https://uatapi.garage.app`, namespace `/tasks`, path `/taskroomv2/socket/` (hardcoded; a comment suggests moving it to an env var such as `NEXT_PUBLIC_SOCKET_URL`).
- **Background work:** reconnect timers made with `setTimeout` (3 s by default, 2 s after `reconnect_failed`).

## Dependencies
- **Packages:** `socket.io-client` - `io` and `Socket`.

## Used by
- `components/athena/components/card-modal.tsx` - in an effect, decodes the `garage_tok` JWT from localStorage and calls `timeSocketService.connect(payload.userId, card._id)`, then disconnects on cleanup. It passes `timeSocketService.socketId` as `socketId` when creating or deleting checklist tasks and when completing checklist items through `NEXT_PUBLIC_TASKROOM_URL`.

## Notes
- It is a module-level singleton, so only one task socket exists per browser tab. Opening a second card modal replaces the first connection.
- The URL points at the UAT host even in production builds.
- Leftover debug logging (`'234234345345'`) and many commented-out store integrations show it was only partly adapted from the board socket service.
