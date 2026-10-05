# `app/(dashboard)/flowboard/lib/use-notification-socket-status.ts`

> React hook that mirrors the Flowboard notification socket's connection state and server-assigned socket id into component state.

**Kind:** Next.js app-directory module (colocated) · **Lines:** 103

## Purpose
The notification socket singleton (`notificationSocketService`) changes outside React. This hook lets a component re-render on connect/disconnect and read the current `socketId`, which Flowboard REST calls send so the server can avoid echoing a change back to its sender.

## How it works
- Initial state copies `connected`, `reconnecting`, `connecting`, `error` and `socketId` from the service.
- On mount it subscribes, with stable named handlers, to:
  - `connected` - `connected: true`, clears `reconnecting`, `connecting`, `error`.
  - `disconnected` - `connected: false`, `socketId: null`.
  - `reconnecting` - `reconnecting: true`, `connected: false`.
  - `reconnect` - `reconnecting: false`, `connected: true`.
  - `connect_error` - `connecting: false`, `reconnecting: true`, `connected: false`, `error` from the message (default "Connection failed").
  - `your-id` - stores the id the server sent.
- It then re-syncs from the service in case the socket connected before the effect ran, and on unmount unsubscribes the same handler references (so unlike `use-board-socket-status.ts`, cleanup is correct).

## Exports
- `useNotificationSocketStatus(): { connected: boolean; reconnecting: boolean; connecting: boolean; error: string | null; socketId: string | null }`.

## Interfaces
- **Socket.IO events:** listens (via the service's listener registry) to `connected`, `disconnected`, `reconnecting`, `reconnect`, `connect_error`, `your-id`.

## Dependencies
- **Internal:** `app/(dashboard)/flowboard/lib/notification-socket-service.ts` - the notification socket singleton.
- **Packages:** `react` - `useState`, `useEffect`.

## Used by
Appears unused: nothing imports it. `app/(dashboard)/flowboard/page.tsx` implements the same subscription logic inline instead.
