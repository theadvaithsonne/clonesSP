# `app/(dashboard)/taskroom/all-taskrooms/componentsSymbol/hooks/use-chat.ts`

> React hook that wraps the Taskroom chat Socket.IO singleton (`socketService`) and exposes its connection state plus `connect`, `disconnect` and `emit`.

**Kind:** Next.js app-directory module (colocated) · **Lines:** 75

## Purpose
Taskroom chat runs over a Socket.IO connection owned by the module singleton `socketService` in `../services/chat-service.ts`. That service connects to the `/chat` namespace of the external host `https://uatapi.garage.app`, not to this repo's Socket.IO server. This hook gives components a reactive view of that connection, so they can re-render when the socket connects or drops.

## How it works
- Initial `connected` and `connecting` state are read from `socketService`.
- On mount, if the service is neither connected nor connecting, the hook calls `socketService.connect()`. The service authenticates with a token from `localStorage` (`auth-token`, otherwise `garage_tok`).
- It subscribes to three service-level events:
  - `connected` sets connected to true and connecting to false.
  - `disconnected` sets both flags to false.
  - `connect_error` sets connecting to false.
- It re-syncs both flags right after subscribing, in case the socket changed state in between.
- On unmount it removes only its own listeners. It does **not** disconnect, because the socket is shared and outlives the component. The service also auto-reconnects 3 s after a non-manual disconnect.
- `connect`, `disconnect` and `emit` are stable `useCallback` wrappers around the service methods.
- `socket` is read from `socketService.socket` at render time. It is not React state, so a new socket instance only becomes visible on the next re-render, which a connection-state change usually triggers.

## Exports
- `useChat(): UseChatReturn` - the hook.
- `interface UseChatReturn` - `{ socket: Socket | null; connected: boolean; connecting: boolean; connect(): void; disconnect(): void; emit(event: string, data?: any): void }`.

## Interfaces
- **Socket.IO events:** listens for the service-level events `connected`, `disconnected` and `connect_error`. Any event can be emitted through `emit`.
- **External services:** the Socket.IO `/chat` namespace at `https://uatapi.garage.app`, via `chat-service.ts`.

## Dependencies
- **Internal:** `../services/chat-service` (`socketService` singleton).
- **Packages:** `react`; `socket.io-client` (the `Socket` type only).

## Used by
- `app/(dashboard)/taskroom/all-taskrooms/componentsSymbol/chat-view.tsx`. `kanban-board.tsx` imports `ChatView` but its render is commented out, and the board's "chat" tab is hidden, so this hook appears unreachable in the current UI.
