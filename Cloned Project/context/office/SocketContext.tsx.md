# `context/office/SocketContext.tsx`

> React context that opens a Socket.IO connection to the external office (networkchains) backend whenever an office user is signed in.

**Kind:** React context · **Lines:** 55

## Purpose
Provides a shared Socket.IO client for the `components/office/*` chat UI. It connects to the separate office service (`NEXT_PUBLIC_OFFICE_API_URL`), **not** to this project's own Socket.IO server (`server/realtime/socket.ts` / `lib/socket.ts`).

## How it works
- Reads `user` from `useOfficeAuth()` (`context/office/AuthContext.tsx`).
- Effect keyed on `user`:
  - no user -> disconnects any existing socket, clears the ref, sets `connected = false`;
  - user present -> reads `office_access_token` from localStorage (bails out if missing) and calls `io(NEXT_PUBLIC_OFFICE_API_URL ?? 'http://localhost:5000', { auth: { token }, transports: ['websocket', 'polling'] })`.
- Tracks `connect` / `disconnect` events in `connected` state. Cleanup disconnects the socket when `user` changes or the provider unmounts.
- The socket lives in a ref; consumers see it through the context value `socket: socketRef.current`, which only updates on the next re-render (the `connected` state change provides that).

## Exports
- `OfficeSocketProvider({ children })` - provider that owns the socket connection; must sit inside `OfficeAuthProvider`.
- `useOfficeSocket()` - returns `{ socket: Socket | null, connected: boolean }` (defaults to `{ socket: null, connected: false }` outside a provider; does not throw).

## Interfaces
- **Socket.IO events:** listens for `connect`, `disconnect`. Application events are handled by consumers (e.g. `components/office/ChatPanel.tsx` listens for `dm_message` and emits `dm_send`).
- **External services:** office Socket.IO server at `NEXT_PUBLIC_OFFICE_API_URL`.
- **Environment variables:** `NEXT_PUBLIC_OFFICE_API_URL` - socket URL (fallback `http://localhost:5000`).
- **Browser storage / cookies:** reads localStorage `office_access_token` as the handshake `auth.token`.

## Dependencies
- **Internal:** `context/office/AuthContext.tsx` - current office user and gate for connecting.
- **Packages:** `react`, `socket.io-client`.

## Used by
- `components/office/ChatPanel.tsx`

## Notes
- The fallback URL (`http://localhost:5000`) differs from `lib/office-api.ts`'s HTTP fallback (`https://backend.networkchains.com`); without the env var, REST and socket would hit different hosts.
- `OfficeSocketProvider` is not rendered anywhere and `ChatPanel.tsx` has no importers, so this context appears unused at runtime.
