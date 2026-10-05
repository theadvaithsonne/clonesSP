# `app/(dashboard)/flowboard/[symbol]/components/kanban-board-list-view.tsx`

> The "List" tab of a Flowboard board: shows each stage as a table of its cards, with per-stage and board-level infinite scroll, inline "Add task", and the card editor modal.

**Kind:** Next.js app-directory module (colocated) · **Lines:** 823

## Purpose
A Flowboard board (`/flowboard/[symbol]`) can be viewed as kanban columns or as a list. `kanban-board.tsx` owns the board's `columns` state (stages with their cards), the board socket connection and the header. When its `activeTab` is `"List"`, it renders this component, passing that state down. This view only presents and extends the same `columns` array. Edits made here, or in the `CardModal` it opens, are written back through `setColumns`, so both views stay consistent. Data comes from the external Flowboard service at `https://uatapi.garage.app/flowboard` through the `store/flowboard/*` stores.

## How it works

### Inputs and derived state
- **Props:** `columns`, `setColumns`, `connected` (board-socket status) and `sortOrder` (`"old-to-new"` means `asc`, anything else `desc`).
- **Board id:** `boardId` comes from the route parameter `params.symbol`.
- **Read-only mode:** `isReadOnly` is true when `useBoardStore().memberData.role === "observer"`. `blockIfReadOnly()` shows "Observers can only view this board" and blocks the action.
- **Current user:** `userData` (`{ id, organizationId }`) is read on mount from `localStorage.garage_tok` with `JSON.parse`. See Notes: that value is a JWT, so the parse fails.
- **Unauthorized boards:** if `useBoardStore().error === "Unauthorized for this operation"`, the component renders `<UnauthorizedView />` instead.

### Transform helpers (L23-L54)
`transformCard(card, stageId)` and `transformStageFromApi(stage)` turn Flowboard API rows into the `Card` / `Column` shapes from `kanban-board.tsx`:
- `assigneeData` becomes `members`;
- `TaskDataCount` is carried over;
- `cardData` becomes `cards`;
- `cardCount` is copied to `localCardCount`.

These copy the column board's own logic, but leave missing counts `undefined` instead of defaulting them to 0.

### Board-level infinite scroll (more stages)
- A scroll listener on the outer list container (`listScrollRef`) fires when the user is within 400px of the bottom.
- If the board store is not loading and `boardDetailsMetadata.currentPage < totalPages`, it calls `fetchBoardDetails(boardId, currentPage + 1, 10, sortDirection)`. The store requests `GET /v1/boards/detail/:id?page&size&sortBy=createdAt&sortOrder`.
- The returned stages are transformed, and only stages whose ids are not already present are appended.
- The first page is not loaded here. That initial-fetch block was removed (commented out) and is left to the parent board.

### Per-stage infinite scroll (more cards)
- Each stage's row list is a scroll box of limited height whose element is stored in `stageScrollRefs`. An effect attaches passive scroll listeners to all of them. Within 280px of the bottom, a listener calls `loadMoreCardsForStage(stage)`.
- `loadMoreCardsForStage` tracks paging per stage in the `stagePagingRef` ref: `{ isFetching, page, totalPages, exhausted }`.
- **When it does nothing:**
  - a request for that stage is already running;
  - the stage is exhausted;
  - `page >= totalPages`;
  - the stage has 10 or fewer cards in total (`cardCount <= 10`).
- **Otherwise:**
  1. It calls `fetchCardsForStage(boardId, stageId, page + 1)` (`GET /v1/cards/list?boardId&stageId&size=10&page`).
  2. It appends the cards that are not already in the column and raises `localCardCount`.
  3. It marks the stage exhausted when a page comes back empty or the last page is reached.
- `stageLoadingMap` drives the "Loading more tasks…" footer.

### Rows
Each card is a clickable 12-column grid row with these cells:

| Cell | Content |
|---|---|
| Task | The card name |
| Description | Hidden on mobile; shows "No description" when empty |
| Assignee | `renderAssignees`: up to 3 initials avatars and a "+N" count, or "Unassigned" |
| Checklist | `TaskDataCount.totalCompletedChildCount / totalChildCount` |
| Label | Hidden below `md`; every `tagData` chip in its colour |

Clicking a row sets `activeCard`.

### Card modal sync
- `activeCardIdRef` mirrors the open card's id.
- An effect on `columns` looks that card up again after every change and replaces `activeCard`, so the open `CardModal` always gets fresh props. That includes changes that arrive over the socket through the parent.
- If the card has disappeared (deleted), the modal closes.
- `CardModal` is rendered through `createPortal` into `document.body`. It receives `boardId`, `connected`, `setColumns`, `isReadOnly`, `userId` / `orgId` from `userData`, and a no-op `updateTaskAndCardCounts` that only logs.

### Inline "Add task"
- "+ Add task" in a stage header opens a one-line input.
- **`handleCreateTask(stageId)`:**
  1. Checks the title, and also needs `userData.organizationId`.
  2. Calls `createCard({ boardId, stageId, name, description: "", tags: [], assignedToIds: [] })` (`POST /v1/cards`).
  3. Prepends the transformed card to the stage and raises `localCardCount`.
  4. Calls `incrementCardCount(boardId)` on the board store.

### Share overlay
`membersharing` controls a share panel with:
- a copy-link button (`handleCopy`, which uses a hidden textarea and `document.execCommand('copy')`);
- Facebook, WhatsApp, Telegram and LinkedIn share links.

All of them point at the hardcoded `https://flowboard-new-garage-app.vercel.app/flowboard/:boardId`. Nothing in this file ever sets `membersharing` to true, so the panel never opens from this view.

## Exports
- `KanbanBoardListView({ columns, setColumns, connected, sortOrder? }: kannprops)` - the list view.

## Interfaces
- **External services:**
  - Flowboard API, through the stores (Bearer `garage_tok`):
    - `GET /v1/boards/detail/:boardId?page&size=10&sortBy=createdAt&sortOrder` - more stages
    - `GET /v1/cards/list?boardId&stageId&size=10&page` - more cards for a stage
    - `POST /v1/cards` - create a card
  - Social share URLs: facebook.com, api.whatsapp.com, t.me, linkedin.com.
  - The share target `flowboard-new-garage-app.vercel.app`, a separate deployment of Flowboard.
- **Browser storage / cookies:** reads `localStorage.garage_tok`.

## Dependencies
- **Internal:**
  - `./kanban-board` - `Card` / `Column` types.
  - `./card-modal` - the card editor.
  - `./unauthorized-view` - the access-denied screen.
  - `./share-modal`, `./board-members-modal` - imported but never rendered here.
  - `store/flowboard/boardStore.tsx` - `fetchBoardDetails`, `boardDetailsMetadata`, `isLoading`, `memberData`, `error`, `incrementCardCount`.
  - `store/flowboard/cardStore.ts` - `fetchCardsForStage`, `createCard`.
  - `store/flowboard/memberStore.ts`, `store/flowboard/userStore.ts` - values read but unused.
  - `components/ui/button.tsx`, `avatar.tsx`, `skeleton.tsx` - imported but unused.
- **Packages:**
  - `react` - hooks.
  - `react-dom` - `createPortal`.
  - `next` - `useParams` / `useRouter`.
  - `lucide-react` - icons.
  - `sonner` - toasts.
  - `js-cookie` - imported but unused.

## Used by
- `app/(dashboard)/flowboard/[symbol]/components/kanban-board.tsx` - rendered when `activeTab == "List"`.
- `app/(dashboard)/flowboard/[symbol]/page.tsx` - imported, but its usages are commented out.
- Reached in the browser at `/flowboard/[symbol]` after switching to the List tab.

## Notes
- **Broken user parsing:** `localStorage.garage_tok` holds the session JWT. Other Flowboard files decode it with `jwtDecode` or `atob`; this file calls `JSON.parse`, which throws, so `userData` stays `null`. As a result:
  - `handleCreateTask` returns silently at its `organizationId` check, so "Add" does nothing in the list view;
  - the modal gets `userId` `undefined`, so comment Edit/Delete links never show for the author.
- The "Checklist" column shows the task/checklist `TaskDataCount`. The code comment above it says "Due date", and `renderPriority` / `renderProgress` / `formatDate` are defined but unused.
- Dead state: `isShareModalOpen`, `isMembersModalOpen`, `isFetchingBoard`, `copied` (set but never shown), `isLoadingMembers`, `isUserProfileFetched`, `fetchMembers`, `fetchBoardById`, `currentBoard`.
- `console.log` calls on every render (`memberData`, `columns`).
- The board-level scroll effect's dependencies leave out `setColumns`. The parent's setter is stable, so in practice this is harmless.
