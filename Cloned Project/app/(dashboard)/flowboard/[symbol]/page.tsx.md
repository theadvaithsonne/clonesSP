# `app/(dashboard)/flowboard/[symbol]/page.tsx`

> The Flowboard single-board page: opens the board-scoped Socket.IO connection for the board in the URL and renders the Kanban board.

**Kind:** Next.js page (client component) · **Lines:** 78 · **Route:** `/flowboard/[symbol]`

## Purpose
Each Flowboard board is opened at `/flowboard/<boardId>` (the dynamic segment is named `symbol` but holds the board id; the board list in `app/(dashboard)/flowboard/page.tsx` navigates with `router.push(`/flowboard/${board.id}`)`). This page is a thin shell: it owns the lifetime of the real-time board socket and hands the connection status to `KanbanBoard`, which does all fetching and rendering.

## How it works
- Reads `boardId` from `useParams<{ symbol: string }>()`.
- Uses `useBoardSocketStatus()` to get `connected` / `reconnecting` from the board socket singleton.
- Subscribes to `userProfile` and `isUserProfileFetched` from the Flowboard user store. They are only used as effect dependencies now; the gate that waited for the profile is commented out.
- **Socket effect:** when a `boardId` exists, reads the JWT from `localStorage["garage_tok"]`, decodes it with `jwt-decode`, and calls `boardSocketService.connect(payload.userId, boardId)`. The cleanup calls `boardSocketService.disconnect()`, so leaving the page (or changing board) tears the socket down. If no token is stored, no socket is opened.
- **Render:** a full-height white container with `<KanbanBoard connected={connected} />`. A connection-status pill, a `viewMode` toggle (`"board" | "list"`) and `KanbanBoardListView` are all present but commented out, so `viewMode`, `setViewMode` and `reconnecting` are unused.

## Exports
- `default Home()` - the page component.

## Interfaces
- **Socket.IO events:** indirectly, via `boardSocketService`, connects to the external Flowboard Socket.IO server (namespace `/boards`, path `/flowboard/socket/`) with `userId` and `boardId` in the query.
- **External services:** Flowboard real-time server at `https://uatapi.garage.app` (not this repo's Socket.IO server).
- **Browser storage / cookies:** reads `localStorage["garage_tok"]`.

## Dependencies
- **Internal:**
  - `app/(dashboard)/flowboard/[symbol]/components/kanban-board.tsx` - the board UI.
  - `app/(dashboard)/flowboard/[symbol]/components/kanban-board-list-view.tsx` - imported for the (disabled) list view.
  - `app/(dashboard)/flowboard/lib/board-socket-service.ts` - board socket singleton.
  - `app/(dashboard)/flowboard/lib/use-board-socket-status.ts` - React status hook for that socket.
  - `store/flowboard/userStore.ts` - Flowboard user profile state.
- **Packages:** `react`, `next` (`useParams`), `jwt-decode` (read `userId` from the token).

## Used by
Not imported anywhere; reached by Next.js routing at `/flowboard/[symbol]`, wrapped by `app/(dashboard)/flowboard/layout.tsx` (which owns the separate notification socket).

## Notes
- The JWT is only decoded, not verified; it is used purely to get the user id for the socket query. `jwtDecode` throws on a malformed token and there is no try/catch here.
- The component name `Home` is a leftover; it is the board page.
