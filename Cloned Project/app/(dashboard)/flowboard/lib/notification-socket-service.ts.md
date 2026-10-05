# `app/(dashboard)/flowboard/lib/notification-socket-service.ts`

> A singleton Socket.IO client for user-level Flowboard notifications: connects to the external Flowboard server's `/notifications` namespace with the user's auth token, reconnects manually, and forwards every event to registered listeners.

**Kind:** Next.js app-directory module (colocated) · **Lines:** 267

## Purpose
While the board socket (`board-socket-service.ts`) carries events for the board that is open, the notification socket carries events across all boards the user belongs to: boards created, updated or deleted, and stage/card counts changing. It powers the live board list at `/flowboard` and gives each client a socket id that REST writes include so the server can avoid echoing changes back to the sender. The server is the external Flowboard service at `https://uatapi.garage.app`, not this repo's Socket.IO server.

## How it works

### State
Public: `socket`, `connected`, `connecting`, `reconnecting`, `error`, `socketId`. Private: the `listeners` map, `healthCheckInterval` (declared and cleared but never started), `reconnectTimeout`, `lastDisconnectTime`, `userId`, and the hard-coded `SOCKET_URL`.

### `connect(userIdFromProfile?)` (L20-L176)
1. Returns if already connected and not reconnecting.
2. Reads the auth token from `localStorage["auth-token"]`, falling back to the `auth-token` cookie (the main Garage login token written by `store/authStore.tsx` and `lib/account-session.ts`).
3. Caches `userIdFromProfile` as `userId` so reconnects can reuse it.
4. With no token it sets `error`, emits `auth_error` to listeners and returns without connecting.
5. Tears down any previous socket and pending reconnect timer, then opens `io("https://uatapi.garage.app/notifications", { path: "/flowboard/socket/", auth: { token }, transports: ["websocket","polling"], timeout: 10000, forceNew: true, query: { userId }, reconnection: false })`.
6. Handlers:
   - `your-id` - stores the server-assigned id in `socketId` and forwards it.
   - `connect` - sets flags, clears `lastDisconnectTime` and any reconnect timer, notifies both `connected` and `reconnected`.
   - `disconnect` - clears flags; for anything except a deliberate `"io client disconnect"` it records `lastDisconnectTime`, notifies `disconnected` (and `reconnecting` if it had been connected) and schedules a reconnect.
   - `board:created` - log only (listeners still get it via `onAny`).
   - `connect_error` - records the error, notifies, schedules a reconnect.
   - `reconnect_attempt`, `reconnect`, `reconnect_failed`, `error` - update flags and notify.
   - `onAny` - forwards every server event to listeners.

### `disconnect()` (L178-L202)
Clears timers, closes and detaches the socket, resets flags. Registered listeners are kept.

### Listener registry and emit
`on(event, handler)`, `off(event, handler?)` and the internal `notifyListeners` (each handler wrapped in try/catch) mirror the board socket service. `emit(event, data?)` only sends while connected and otherwise logs a warning.

### Manual reconnect (`scheduleReconnect`, L240-L261)
Fixed-delay retry (3000 ms default, 2000 ms after `reconnect_failed`) that calls `connect(this.userId)` with a fresh socket if still disconnected; repeats indefinitely. Each attempt re-reads the token, so a logged-out user stops reconnecting (the attempt ends in `auth_error`).

## Exports
- `notificationSocketService` - the single `NotificationSocketService` instance.

## Interfaces
- **Socket.IO events:** namespace `/notifications`, path `/flowboard/socket/`, `auth.token`, query `userId`. Handles `your-id` and logs `board:created`. Synthetic listener events: `connected`, `reconnected`, `disconnected`, `reconnecting`, `connect_error`, `auth_error`, `reconnect_attempt`, `reconnect`, `reconnect_failed`, `error`. Consumers subscribe to server events such as `board:created`, `board:updated`, `board:deleted`, `stage:created`, `stage:deleted`, `card:created`, `card:deleted`.
- **External services:** Flowboard real-time server at `https://uatapi.garage.app`.
- **Browser storage / cookies:** reads `localStorage["auth-token"]` or the `auth-token` cookie.
- **Background work:** `setTimeout` reconnect loop.

## Dependencies
- **Packages:** `socket.io-client` - connection; `js-cookie` - cookie fallback for the token.

## Used by
- `app/(dashboard)/flowboard/layout.tsx` - connects on entering `/flowboard*`, disconnects on leaving.
- `app/(dashboard)/flowboard/page.tsx` - board-list live updates and `socketId` for REST calls.
- `app/(dashboard)/flowboard/lib/use-notification-socket-status.ts` - status hook.
- `app/(dashboard)/flowboard/[symbol]/components/kanban-board.tsx`, `card-modal.tsx`, `share-modal.tsx`, and `store/flowboard/cardStore.ts`.

## Notes
- Two different tokens are in play: the layout decides whether to connect using the `garage_tok` JWT, while this service authenticates with `auth-token`. A user with only one of them will not get a notification socket.
- `healthCheckInterval` is dead code.
