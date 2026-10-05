# `app/(dashboard)/taskroom/all-taskrooms/componentsSymbol/services/chat-service.ts`

> Singleton Socket.IO client for the external chat namespace (`https://uatapi.garage.app/chat`) with manual reconnect and a fan-out listener registry, auto-connected when the module loads in the browser.

**Kind:** Next.js app-directory module (colocated) · **Lines:** 187

## Purpose
The Taskroom chat (via the `use-chat` hook) needs live connection state and real-time events from the external chat server. This module provides one shared `ChatSocketService` instance so every consumer shares a single socket. It talks to the UAT chat server, not to this repo's own Socket.IO server (`server/realtime/socket.ts`).

## How it works
- **Connect (`connect`)** - skips if a socket already exists and is connected or connecting. The token is taken from `localStorage["auth-token"]`, falling back to `localStorage["garage_tok"]`; with no token it sets `error` and returns. It then opens `io("https://uatapi.garage.app/chat", { auth: { token }, transports: ["websocket", "polling"], timeout: 5000, reconnection: false })`.
- **Lifecycle events** - on `connect` it sets `connected` and notifies listeners of a synthetic `connected` event; on `disconnect` it notifies `disconnected` and, unless the client disconnected on purpose (`"io client disconnect"`), schedules a reconnect after 3 seconds; `connect_error` and `error` set `error` and notify listeners.
- **Event fan-out** - `socket.onAny` forwards every server event to handlers registered via `on()`. `on()` stores the handler in an internal `Map<event, Set<handler>>` and also attaches it directly to the current socket; `off()` removes it from both.
- **Emit** - `emit(event, data)` only sends while connected, otherwise logs a warning and drops the event.
- **Disconnect** - clears any pending reconnect timer, disconnects and nulls the socket.
- **Auto-connect** - at the bottom of the module, `socketService.connect()` is called whenever the module is evaluated in a browser.

## Exports
- `socketService` - the singleton `ChatSocketService` with `socket`, `connected`, `connecting`, `error`, `connect()`, `disconnect()`, `on(event, handler)`, `off(event, handler)`, `emit(event, data?)`.

## Interfaces
- **Socket.IO events:** emits whatever callers pass to `emit`; surfaces synthetic `connected`, `disconnected`, `connect_error`, `error` to listeners; forwards all server events through `onAny`.
- **External services:** chat Socket.IO server at `https://uatapi.garage.app`, namespace `/chat` (hardcoded).
- **Browser storage / cookies:** reads `localStorage` `auth-token` then `garage_tok`.
- **Background work:** a 3-second reconnect `setTimeout` after unexpected disconnects.

## Dependencies
- **Packages:** `socket.io-client` (the socket); `js-cookie` (imported, unused).

## Used by
`componentsSymbol/hooks/use-chat.ts`, which subscribes to `connected` / `disconnected` / `connect_error` and wraps `emit`; used by `chat-view.tsx` on `/taskroom/all-taskrooms`.

## Notes
- A handler registered with `on()` while a socket exists is attached to the socket directly and is also called by the `onAny` forwarder, so it runs twice per server event. Handlers registered before the socket existed are only called via `onAny`. The synthetic `connected`/`disconnected` events are only delivered through the registry.
- Importing the module opens a connection as a side effect, even if the chat tab is never shown.
- A very similar socket service exists at `componentsSymbol/taskroom-chat/lib/socket-service.ts`.
