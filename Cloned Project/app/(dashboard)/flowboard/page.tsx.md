# `app/(dashboard)/flowboard/page.tsx`

> The Flowboard home page: lists the user's starred and all boards with infinite scroll, lets them create, edit, star and delete boards, and keeps the list live through the Flowboard notification socket.

**Kind:** Next.js page (client component) · **Lines:** 778 · **Route:** `/flowboard`

## Purpose
Flowboard is Garage's Trello-style Kanban feature. This page is its dashboard: a grid of board cards, split into "Starred Boards" and "All Boards", each linking to `/flowboard/<boardId>`. Data and mutations go through the zustand `useBoardStore`, which talks to the external Flowboard REST API at `https://uatapi.garage.app/flowboard/v1`, not this repo's backend. Real-time updates arrive on the user-level notification socket that `app/(dashboard)/flowboard/layout.tsx` opens.

## How it works

### `BoardCard` (L27-L129)
One board tile. Clicking the tile navigates to `/flowboard/${board.id}`. Shows:
- A colour header (`board.color`) with a star toggle that calls `toggleStar(id, !board.starred, notificationSocketId)`.
- Name, description ("No description" fallback), `board.lists` / `board.cards` counts, member initials from `board.boardUsers.userData`, and `board.lastUpdated`.
- Edit (pencil) and delete (trash) buttons, shown only when `board.userId == userId` (the board owner). Delete asks `confirm(...)` and calls `deleteBoard(board.id, notificationSocketId)`.

Star and delete only run when `notificationSocketId` is known; before the socket has sent `your-id` the clicks do nothing.

### Skeletons (L131-L176)
`SkeletonBoardCard` and `BoardSkeletonLoader` (4 starred + 8 all placeholders) are shown while the first pages load and both lists are empty.

### `BoardModal` - create and edit (L178-L301)
A modal with name, optional description and a palette of eight colours (`COLORS`).
- **Edit** (a `board` is passed): sends only changed fields through `updateBoard(board.id, updates, notificationSocketId)`. If nothing changed it just closes. If `notificationSocketId` is missing the update is skipped silently and the modal still closes.
- **Create**: `addBoard({ name, description, color, socketId: notificationSocketId })`.
- Name must be non-empty; `isSubmitting` disables inputs and shows "Saving..." / "Creating...". Errors are only logged.

### `FlowBoards` - main component (L304-L776)

**Identity (L485-L515).** On mount (and whenever `isUserProfileFetched` changes) it decodes `localStorage["garage_tok"]` with `jwt-decode`. If the payload has `userId` and `orgId` it stores them and fetches page 1 of both lists in parallel (`fetchAllBoards(1)`, `fetchStarredBoards(1)`), then sets `areInitialBoardsLoaded` and bumps `syncTrigger`. Decode errors are caught and logged.

**Socket status (L357-L402).** Once `userId` is known it copies the notification socket's current state, then subscribes to `connected`, `disconnected`, `reconnecting`, `reconnect` and `your-id` to keep `isSocketConnected`, `isSocketConnecting` and `notificationSocketId` current. Cleanup removes only these listeners; the socket itself stays open (the layout owns it).

**Live count updates (L406-L436).** Notification-socket events adjust counters in the store:
- `stage:created` -> `incrementListCount(payload.data.boardId)`
- `stage:deleted` -> `decrementListCount(payload.boardId)`
- `card:created` -> `incrementCardCount(payload.data.boardId)`
- `card:deleted` -> `decrementCardCount(payload.boardId)`

Note the differing payload shapes (`data.boardId` for creates, top-level `boardId` for deletes).

**Live board updates (L439-L462).** `board:created` -> `addBoardSocket(payload.data)`; `board:updated` -> `updatesocket(payload._id, payload)`; `board:deleted` is only logged, so a board deleted by someone else stays visible until reload.

**Joining notification rooms (L473-L566).** After the initial load and once a `notificationSocketId` exists, the page collects the unique ids of all loaded boards (all + starred) and calls `POST https://uatapi.garage.app/flowboard/v1/users/join/notifications` with `{ notificationSocketId, boardIds }` and the `garage_tok` bearer token. This tells the Flowboard server which boards' events to push to this socket. A sorted-JSON fingerprint in `lastSyncedIdsRef` prevents re-sending the same set; `syncTrigger` is bumped after each successful page fetch so newly loaded boards get joined. Failures are only logged.

**Infinite scroll (L571-L637).** Two `IntersectionObserver`s watch sentinel divs below each grid (threshold 0.1). On intersection they read fresh metadata with `useBoardStore.getState()` (avoiding stale closures) and fetch `currentPage + 1` while `currentPage < totalPages` and not already loading, then bump `syncTrigger`. Several `useRef` mirrors of loading/metadata/user state are kept updated but the observers do not use them.

**Render (L640-L775).** Header ("FlowBoards", subtitle, "Create Board" button). Then either the skeleton, or the starred section (only when non-empty, with a count badge and its own sentinel) and the "All Boards" grid, which de-duplicates boards by id via a `Map` and ends with a dashed "Create new board" tile. A connection-status badge and a light/dark theme toggle exist but are commented out.

## Exports
- `default FlowBoards` - the page component (`BoardCard`, `BoardModal` and the skeletons are file-private).

## Interfaces
- **External services (Flowboard API, `https://uatapi.garage.app/flowboard/v1`):**
  - Called directly: `POST /users/join/notifications` - subscribe the notification socket to the listed boards.
  - Via `store/flowboard/boardStore.tsx`: `GET /members/myBoards?page=&size=20` (all boards) and `...&isFavorite=true` (starred), `POST /boards` (create), `PUT /boards/{id}` (edit, body includes `notificationSocketId`), `DELETE /boards/{id}?notificationSocketId=...`, `PUT /boards/favorite/{id}` (star, body `{ isFavorite, socketId }`).
- **Socket.IO events:** through `notificationSocketService` listens for `connected`, `disconnected`, `reconnecting`, `reconnect`, `your-id`, `stage:created`, `stage:deleted`, `card:created`, `card:deleted`, `board:created`, `board:updated`, `board:deleted`.
- **Browser storage / cookies:** reads `localStorage["garage_tok"]` (JWT for identity and bearer auth).

## Dependencies
- **Internal:**
  - `store/flowboard/boardStore.tsx` - board lists, pagination metadata, CRUD, star, counter and socket-merge actions; `Board` type.
  - `store/flowboard/userStore.ts` - `isUserProfileFetched` (used as an effect trigger).
  - `store/flowboard/themeStore.ts` - `theme`/`toggleTheme` (read, but the toggle UI is commented out).
  - `app/(dashboard)/flowboard/lib/notification-socket-service.ts` - notification socket singleton.
- **Packages:** `react`, `next` (`useRouter`), `lucide-react` (icons), `jwt-decode`, `js-cookie` (imported but unused).

## Used by
Not imported; reached by Next.js routing at `/flowboard`, wrapped by `app/(dashboard)/flowboard/layout.tsx`.

## Notes
- Bug: `orgIdRef.current = parsed._orgId` (L503) reads a non-existent `_orgId` claim; harmless because `orgIdRef` is never read.
- Edit, star and delete silently no-op when the notification socket has not yet sent its id; create still proceeds with `socketId: null`.
- The owner check uses loose equality (`board?.userId == userId`) and is UI-only; the Flowboard server must enforce permissions.
- Many leftover `console.log` calls, including ones on every render of each `BoardCard` and `BoardModal`.
- Infinite-scroll observers are recreated whenever the loading flags change; they are unobserved but never `disconnect()`ed.
- All API URLs are hard-coded to the UAT Flowboard host.
