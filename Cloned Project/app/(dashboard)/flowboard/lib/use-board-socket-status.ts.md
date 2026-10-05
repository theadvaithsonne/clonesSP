# `app/(dashboard)/flowboard/lib/use-board-socket-status.ts`

> React hook that mirrors the Flowboard board socket's connection state (`connected`, `reconnecting`, `connecting`, `error`) into component state.

**Kind:** Next.js app-directory module (colocated) · **Lines:** 88

## Purpose
`boardSocketService` is a plain singleton whose fields change outside React. This hook subscribes to its synthetic connection events so a component re-renders when the board socket connects, drops or errors. The board page passes the resulting `connected` flag down to `KanbanBoard`.

## How it works
- Initial state is copied from `boardSocketService` fields.
- On mount it registers handlers via `boardSocketService.on(...)`:
  - `connected` - sets `connected: true` and clears `reconnecting`, `connecting` and `error`.
  - `disconnected` - `connected: false`.
  - `reconnecting` - `reconnecting: true`, `connected: false`.
  - `reconnect` - `reconnecting: false`, `connected: true`.
  - `connect_error` - `connecting: false`, `reconnecting: true`, `connected: false`, `error` set to the error message or "Connection failed".
- After subscribing it re-syncs from the service fields in case the socket changed before the effect ran.
- On unmount it calls `boardSocketService.off(...)` for each event.

## Exports
- `useBoardSocketStatus(): { connected: boolean; reconnecting: boolean; connecting: boolean; error: string | null }`.

## Interfaces
- **Socket.IO events:** listens (through the service's listener registry) to `connected`, `disconnected`, `reconnecting`, `reconnect`, `connect_error`.

## Dependencies
- **Internal:** `app/(dashboard)/flowboard/lib/board-socket-service.ts` - the board socket singleton.
- **Packages:** `react` - `useState`, `useEffect`.

## Used by
- `app/(dashboard)/flowboard/[symbol]/page.tsx` (route `/flowboard/[symbol]`).

## Notes
- **Listener leak:** four of the five subscriptions wrap the handler in a new arrow function (`() => handleDisconnected()`, etc.), but the cleanup passes the original named handler to `off`. Those wrappers are never removed, so every mount leaves handlers behind that call `setState` on an unmounted component. Only `connected` is cleaned up correctly. `use-notification-socket-status.ts` does not have this problem.
