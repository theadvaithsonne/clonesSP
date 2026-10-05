# `app/(dashboard)/flowboard/[symbol]/components/kanban-board.tsx`

> The main Flowboard board screen: a Trello-style Kanban board (stages as columns, cards inside them) with drag-and-drop, infinite horizontal paging, real-time socket updates, a List view tab, search, sharing and member management.

**Kind:** Next.js app-directory module (colocated) · **Lines:** 2290

## Purpose

Flowboard is the Kanban / task-board feature of Garage. Its data does not live in this repository: every board, stage (list), card, member and tag is stored by the external **Flowboard API at `https://uatapi.garage.app/flowboard/v1/...`**, and live updates arrive over that service's Socket.IO `/boards` namespace. This component is the orchestrator for one board (`/flowboard/<boardId>`). It owns the board's column state (`columns: Column[]`), delegates HTTP calls to the zustand stores under `store/flowboard/`, listens to board socket events to keep the view in sync with other users, and renders the header, toolbar, the Board or List view and several modals.

It also defines the `Card` and `Column` TypeScript shapes that every other Flowboard board component imports.

## How it works

### Types and transforms (L68-L167)
- `JwtPayload` - loose shape for the decoded `garage_tok` JWT.
- `Card` / `Column` (exported) - the UI model. A card carries tags (`tags` ids + `tagData` objects), `members` (assignees), dates, `isOverDue` / `isCompleted`, `commentCount`, `stageId`, `assignedToIds`, and `TaskDataCount` (`totalChildCount` / `totalCompletedChildCount`, the checklist progress shown as `x/y` on a card). A column has `cards`, the server's `cardCount` and a locally maintained `localCardCount` badge.
- `transformCard(card, stageId)` maps an API card (`assigneeData` -> `members`, defaults for missing fields) and `transformStage(stage)` maps an API stage (`cardData` -> `cards`).

### State and identity (L169-L281)
- `boardId` comes from the `[symbol]` route segment (`useParams().symbol`).
- `userData` (`{ id, organizationId }`) is decoded with `jwtDecode` from `localStorage.garage_tok`; note it reads `parsed.userID` (capital `ID`) and `parsed.orgId`.
- Stores used: `useStageStore` (create/update/delete stage), `useCardStore` (create card, `moveCard`), `useBoardStore` (`fetchBoardById`, `fetchBoardDetails`, `fetchBoardDetailsStageId`, `boardDetailsMetadata` paging info, `currentBoard`, `memberData`, list/card counters, `error`), `useMemberStore` (assigned-member bookkeeping), `useTaskStore` (`socketAddTask`, `tasks`), `useThemeStore` (light/dark toggle) and `useUserStore` (`userProfile` for the avatar initials).
- **Read-only mode:** `isReadOnly` is true when `memberData.role === "observer"`. `blockIfReadOnly()` shows the toast "Observers can only view this board" and is called before every mutating action; drag sensors are disabled for observers.
- **Session expiry:** several actions (and an effect on `boardDetailsMetadata`) base64-decode the JWT payload and, if `exp` has passed, open a "Session Expired" dialog whose button routes to `/login`. This is a client-side check only (no signature verification).
- **Opened card:** `openedCard` is derived from the `?cardId=` query parameter; when it matches a loaded card the `CardModal` is rendered, and closing it removes `cardId` from the URL. Search results and links can therefore deep-link to a card.

### Loading data (L284-L331, L582-L612, L1037-L1117)
- On mount `fetchBoardById(boardId)` loads the board metadata (name, description, `boardUsers`).
- Once `userData.organizationId` is known, `fetchBoardDetails(boardId, 1, 10, "asc"|"desc")` loads the first 10 stages with their first cards; the order follows `sortOrder` (`"new-to-old"` = `desc`, the default).
- `stageFunction(stageId)` reloads the board narrowed to one stage via `fetchBoardDetailsStageId`; `SearchList` calls it when the user clicks a stage search result.
- `onChangeSort` (L1574-L1613) changes `sortOrder` and refetches page 1.
- **Horizontal infinite scroll** (L1038-L1075): a scroll listener on the board container fetches the next stage page when within 400px of the right edge and `currentPage < totalPages`, de-duplicating by `_id`.
- **Scroll restoration** (L1079-L1117): a `useLayoutEffect` restores `scrollLeft` with a double `requestAnimationFrame` after columns are appended so the view does not jump.
- Per-column vertical card paging is handled inside `KanbanColumn`.

### Real-time socket handlers (L333-L976)
All handlers subscribe through `boardSocketService` (the singleton client for the external `/boards` namespace) and patch `columns` in place:

| Event | Effect |
| --- | --- |
| `comment:created` / `comment:deleted` | +1 / -1 (floored at 0) on the card's `commentCount` (needs `payload.cardId`). |
| `task:deleted` | Subtracts the deleted task's `childCount` / `completedChildCount` from the card's `TaskDataCount` and `checklist`. |
| `checklist:created` | +1 `totalChildCount`. |
| `checklist:deleted` | -1 `totalChildCount`, and -1 completed if the item was completed. |
| `checklist:updated` | When `completionData` is set, +/-1 `totalCompletedChildCount`. |
| `task:created` | Forwards `payload.data` to `useTaskStore.socketAddTask`. |
| `stage:created` | Adds the stage (front for new-to-old, end otherwise) only if all stage pages are already loaded, so ordering stays correct. |
| `stage:updated` / `stage:deleted` | Renames / removes the column. |
| `card:created` | Appends the card to its stage and bumps `localCardCount`. |
| `card:updated` | Handles several flags: `addTag` (append tag), `name`, `description`, `moveData` (move card from `stageId` to `newStageId`, inserted at top), `completionData` (`isCompleted`), `addMember` (append assignee and update the member store), otherwise removes the member in `userRemoveAssignedToIds`. |
| `card:deleted` | Removes the card from its stage and decrements the count. |
| `tag:updated` / `tag:deleted` | Renames/recolours or strips the tag from every card. |

`updateTaskAndCardCounts(newChildCount, newCompletedChildCount, taskId, cardId)` (L993-L1035) recomputes a card's `TaskDataCount` by summing child counts over all tasks of that card in `useTaskStore`; it is passed down to columns, cards and `CardModal`.

### Drag-to-scroll (L1119-L1173)
Mouse-down on empty board space (not on buttons, inputs, sortable/droppable items, or the bottom 20px scrollbar strip) lets the user pan the board horizontally at 1.5x speed. It is suppressed while a card is being dragged.

### Card drag and drop (L1183-L1334)
Built on `@dnd-kit/core` with a `PointerSensor` (8px activation distance) and `closestCorners` collision detection.
- `handleDragStart` snapshots `columns` (deep copy into `originalColumnsRef`) and sets `activeCard`, rendered in a `DragOverlay` portalled to `document.body`.
- `handleDragEnd` finds the target column (dropped on a column, or on a card in a column). Dropping outside restores the snapshot. **Same-column reordering is not persisted** (it returns early). For a cross-column move it updates state optimistically, then calls `moveCard(cardId, targetStageId, boardSocketId)`; on error it rolls back to the snapshot and shows a toast.

### Column and card CRUD (L1338-L1449)
- `addColumn` - `createStage({ name, description: "", boardId, boardSocketId, notificationSocketId })`, inserts it at the front or end depending on sort order, then `incrementListCount(boardId)`.
- `handleUpdateColumn` - `updateStage(id, { name, socketId })`, then renames locally.
- `handleDeleteColumn` - `deleteStage(id, boardSocketId, notificationSocketId)` (only if both socket ids exist), removes the column locally and `decrementListCount`.
- `addCard` - `createCard({ boardId, stageId, name, description: "", tags: [], assignedToIds: [], boardSocketId, notificationSocketId })`, appends it and `incrementCardCount`.
Socket ids are passed so the API can exclude the originating client from the broadcast.

### Rendering (L1453-L2288)
- If the board store's `error` is `"Unauthorized for this operation"`, `UnauthorizedView` is rendered instead.
- **Header:** `SearchList` (global search), a light/dark toggle (`useThemeStore`) and the current user's initials.
- **Title bar:** back button to `/flowboard`, board name/description (skeleton while loading), up to five member initials from `currentBoard.boardUsers.userData` plus a `+N` chip that opens `BoardMembersModal`, an **Invite Member** button (opens `ShareModal`) and a **Share** button (opens the inline share-link modal).
- **Toolbar:** "Board" / "List" tabs and an Old-to-New / New-to-Old `<select>`.
- **List tab:** `KanbanBoardListView` receives `columns`/`setColumns`.
- **Board tab:** skeleton columns while loading, otherwise a `SortableContext` of `KanbanColumn`s. The "Add another list" control sits after the last column for old-to-new, or as a fixed vertical strip on the right for new-to-old.
- **Share-link modal** (L2179-L2248): shows and copies (`document.execCommand('copy')`) a link to `https://flowboard-new-garage-app.vercel.app/flowboard/<boardId>` and offers Facebook, WhatsApp, Telegram and LinkedIn share URLs.
- **Session Expired** dialog.

## Exports
- `KanbanBoard({ connected })` - the board component. `connected` is the board-socket connection flag from the page (`useBoardSocketStatus`) and is passed through to columns, cards, `CardModal` and the list view.
- `interface Card` - UI model of a card (see above).
- `interface Column` - UI model of a stage/list with its cards and counts.

## Interfaces
- **External services:** Flowboard API at `https://uatapi.garage.app/flowboard/v1` via the stores, for example `GET /boards/detail/:boardId?page&size&sortBy=createdAt&sortOrder[&stageId]`, `GET /members/myBoards?...&boardId=` (board metadata), `POST /stages`, `PUT /stages/:id`, `DELETE /stages/:id?boardSocketId&notificationSocketId`, `POST /cards`, `PUT /cards/move/:id`. Flowboard Socket.IO (`/boards` and `/notifications` namespaces on `https://uatapi.garage.app`) via the socket services. Social share endpoints (facebook.com, api.whatsapp.com, t.me, linkedin.com).
- **Socket.IO events:** listens for `comment:created`, `comment:deleted`, `task:created`, `task:deleted`, `checklist:created`, `checklist:updated`, `checklist:deleted`, `stage:created`, `stage:updated`, `stage:deleted`, `card:created`, `card:updated`, `card:deleted`, `tag:updated`, `tag:deleted`. It emits nothing directly; it sends its socket ids with REST calls.
- **Browser storage / cookies:** reads `localStorage.garage_tok` (JWT used for identity and the expiry check). `js-cookie` is imported but unused.

## Dependencies
- **Internal:** `./search-list` (header search), `./card-modal` (card detail), `./kanban-column`, `./kanban-card` (drag overlay), `./kanban-board-list-view` (List tab), `./share-modal` (members/invite), `./board-members-modal`, `./unauthorized-view`; `../../lib/board-socket-service` and `../../lib/notification-socket-service` (socket singletons and socket ids); stores `store/flowboard/{boardStore,cardStore,stageStore,memberStore,taskStore,themeStore,userStore}`; UI primitives `components/ui/{avatar,button,dialog,input,skeleton}`; `lib/utils` (`cn`). `./sort-dropdown` is only referenced in a commented-out import.
- **Packages:** `@dnd-kit/core`, `@dnd-kit/sortable` (drag and drop), `jwt-decode` (token claims), `sonner` (toasts), `lucide-react` (icons), `next/navigation` (params, router, query string), `react-dom` (`createPortal` for the drag overlay), `react`, `js-cookie` (imported, unused).

## Used by
Rendered by `app/(dashboard)/flowboard/[symbol]/page.tsx`, i.e. the route **`/flowboard/<boardId>`** (the `(dashboard)` group is not part of the URL). `card-activity.tsx`, `card-modal.tsx`, `kanban-board-list-view.tsx`, `kanban-card.tsx` and `kanban-column.tsx` import the `Card` / `Column` types from it.

## Notes
- **Listener leak:** the cleanup of the `tag:deleted` effect calls `boardSocketService.on` instead of `.off` (L974), so remounts stack duplicate `tag:deleted` handlers.
- The socket effects have empty dependency arrays, so `handleStageCreate` always sees the initial `sortOrder` (`"new-to-old"`), even after the user changes the sort.
- `handleDragEnd` only calls `moveCard` when a board socket id exists; without one the optimistic move stays on screen but is never saved. `handleDeleteColumn` likewise removes the column locally even if the delete call was skipped.
- Column headers are sortable in `KanbanColumn`, but `handleDragEnd` only understands cards, so column reordering is not supported.
- Share links point to a hardcoded external deployment (`flowboard-new-garage-app.vercel.app`), not this app's origin.
- Dead code: `teamMembers` (hardcoded sample names), `getAvatarColor` (never called, and it would hit a temporal-dead-zone error because `avatarColors` is declared later), many commented-out blocks, unused imports, and many debug `console.log` calls (some log the full column state on every render).
- The share modal nests an `<a>` inside an `<a>` for each social platform, which is invalid HTML.
