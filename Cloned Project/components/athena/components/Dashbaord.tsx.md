# `components/athena/components/Dashbaord.tsx`

> The kanban "Board" view of a Taskroom room: renders stage columns and task cards from the Taskroom workspace store, handles drag-and-drop reordering and moving of cards, inline creation of new stages ("groups"), and opens a shared task from a `?shareTask=` link. The file name is misspelt ("Dashbaord") and the main export is `DahboardMangement`.

**Kind:** React component · **Lines:** 1419

## Purpose
Athena is Garage's project-management module, backed by the external Taskroom service (`NEXT_PUBLIC_TASKROOM_URL`, default `https://uatapi.garage.app/taskroomv2/v2/`). A room has stages (columns, with a `stageType` of `tostart`, `active`, `done` or `closed`) that hold tasks (cards). This component is the board shown when `ProjectMangement.tsx`'s active tab is "Board". It does not load the initial columns itself: they live in `useTaskroomWorkspacetore().columns`, filled and paged by that store. Besides the component, the file is the shared home of the `Card` and `Column` types and the `transformCard` mapper that other Athena components import.

## How it works

### Types and mappers (L79-L237)
- `Card` - the kanban card model (name, description, tag ids and `tagData`, `members`, dates, priority, `stageId`, `stageData`, `TaskDataCount` child counts, attachments, nested `subtasks`, ...).
- `Column` - a stage with `cards`, `taskCount`, `localCardCount` (the count shown and adjusted locally), `stageType`, `orderId`, `color`.
- `transformCard(card, stageId)` maps a Taskroom task (`title`, `assigneeData`, `tagData`, `stageData`, ...) to `Card`, recursively mapping `subtasks`.
- `transformCardCustom` (private) does the same for a create-task response, where `tags` are objects and assignees are in `assignedToIds`.
- `transformStage` (private) maps a stage with embedded `cardData` to `Column`.
- `findColumnByCardId` locates a card's column; `STAGE_PRESET_COLORS` is the 12-colour palette for new groups.

### Context and permissions (L239-L316)
- `boardId` (the room id) and `Idspace` (the space id) come from URL params `roomId` / `spaceId` when `shareTask` is present, otherwise from `currentRoomDetail`.
- `isReadOnly = isRoomObserver(currentRoomDetail, roomMemberData ?? memberData)`. Observers get no drag sensors, and `blockIfReadOnly()` shows "Observers can only view this board" for the "New group" button. `isReadOnly` is also passed down to columns, cards and the card modal.

### Shared task deep link (L341-L368, L1259-L1279)
On mount, if the URL has `shareTask=<taskId>`, it calls `GET {TASKROOM_URL}tasks/:taskId` (bearer `garage_tok`) and stores the transformed task in `sharedCard`, which opens `CardModal`. Closing the modal clears it and navigates to the bare pathname, dropping the share parameters.

### Subtask counts (L403-L443)
`updateTaskAndCardCounts(newChildCount, newCompletedChildCount, taskId, cardId)` recomputes a card's `TaskDataCount` totals from `useTaskStore().tasks` (substituting the new counts for `taskId`) and writes them into the matching card in `columns`. It is passed down to columns, cards and `CardModal`.

### Horizontal scrolling (L445-L562)
- A scroll listener on the board container saves `scrollLeft` and calls the store's `loadMoreStages()` when within 400 px of the right edge (infinite loading of more stages; the store ignores calls while loading or when no pages remain).
- A `useLayoutEffect` restores the saved scroll position (double `requestAnimationFrame`, clamped) after columns are appended, so loading more stages does not jump the view. Skipped on first load.
- Drag-to-scroll: mouse-down on empty board space (not buttons, inputs, cards, droppables or the bottom 20 px scrollbar area) pans the board at 1.5x pointer speed.

### Card drag and drop (L567-L752)
Uses `@dnd-kit/core` with a `PointerSensor` (8 px activation distance). Sensors are removed while read-only or while a move is being saved (`isMovingCard`), because the server's shift API renumbers whole stages and overlapping moves would overwrite each other.
- `collisionDetection` prefers `pointerWithin`, then `rectIntersection`; when the pointer is over a column that has cards it resolves to the closest card (`closestCenter`) so a tall column does not steal the drop. When a cross-column move leaves nothing under the pointer for a frame, it keeps the last target (or the dragged card itself).
- `handleDragStart` deep-copies `columns` into `originalColumnsRef` and sets `activeCard` (rendered in a portalled `DragOverlay` as a `KanbanCard`).
- `handleDragOver` only moves the card between columns while dragging, inserting above or below the hovered card based on the dragged card's vertical midpoint. Same-column reordering is left to the `SortableContext` preview inside `KanbanColumn`.
- `handleDragEnd` commits the in-column reorder with `arrayMove`, works out the neighbour to anchor to (the card now below it, or the card above when dropped last, giving `toBottom: true`), adjusts `localCardCount` of both columns on a stage change, then calls `useCardStore().moveCard(id, { toStageId, toTaskId, toBottom })` (`PUT {TASKROOM_URL}tasks/shift/:id`). If it returns null (failure) the original columns are restored. Dropping outside any target, or a cancelled drag, also restores them.

### Stage and card CRUD (L754-L832)
- `addColumn(name, color)` - `useStageStore().createStage({ name, color, stageType: "active", orderId: 0, roomId })` (`POST {TASKROOM_URL}stages/add`); appends the new column and increments the board's list count.
- `handleUpdateColumn(id, { name?, color? })` - `updateStage` (`PUT {TASKROOM_URL}stages/:id`) then patches the column locally.
- `handleDeleteColumn(id)` - `deleteStage` (`DELETE {TASKROOM_URL}stages/:id`), removes the column and decrements the list count.
- `addCard(columnId, data)` - `createCard` (`POST {TASKROOM_URL}tasks`, priority default `"normal"`), prepends the card (newest first) and increments counts.

### Render (L836-L1416)
- If the board store's `error` is `"Unauthorized for this operation"`, renders `UnauthorizedView` instead.
- Columns are sorted by `stageType` order (`tostart`, `active`, `done`, `closed`) and rendered as `KanbanColumn`s keyed by `column._id:boardLoadId`, so a fresh page-1 load remounts them and resets their own card paging. Hidden while `wsrKLoading`.
- After the columns (when not fetching), a "New group" button expands into an inline form: name, preset colour swatches, a native colour input ("Custom color"), Enter to create, Escape or Cancel to close.
- A spinner shows while more stages load.
- Also rendered: `ShareModal`, `BoardMembersModal`, a social "Share your link" modal, and a "Session Expired" dialog linking to `/login` (see Notes on which of these can actually appear).

## Exports
- `DahboardMangement()` - the board view component (no props).
- `transformCard(card, stageId): Card` - maps a Taskroom task to the kanban `Card` model (used by `AssignedToMe.tsx`).
- `Card` (interface) - kanban card model.
- `Column` (interface) - kanban column / stage model.

## Interfaces
- **External services:** Taskroom API (`NEXT_PUBLIC_TASKROOM_URL`): `GET tasks/:id` (here); via stores: `PUT tasks/shift/:id`, `POST tasks`, `POST stages/add`, `PUT stages/:id`, `DELETE stages/:id`, `GET rooms/detail/:roomId` (board details and stage paging). Share links point at `https://flowboard-new-garage-app.vercel.app/flowboard/<boardId>` and Facebook / WhatsApp / Telegram / LinkedIn share URLs.
- **Environment variables:** `NEXT_PUBLIC_TASKROOM_URL` - Taskroom API base.
- **Browser storage / cookies:** reads `localStorage.garage_tok` for the bearer token.

## Dependencies
- **Internal:** `store/taskroom/taskroomWorkspace.tsx` - `columns`/`setColumns`, current room, `loadMoreStages`, loading flags, `boardLoadId`, `isRoomObserver`; `store/athena/boardStore.tsx` - board details, member role, list/card counters, `error`; `store/athena/stageStore.ts` - stage CRUD; `store/athena/cardStore.ts` - `createCard`, `moveCard`; `store/athena/taskStore.ts` - subtask counts; `store/athena/memberStore.ts`, `userStore.ts`, `themeStore.ts`; `store/taskroom/workspaceStore.ts` (imported only); components `kanban-column.tsx`, `kanban-card.tsx`, `card-modal.tsx`, `share-modal.tsx`, `board-members-modal.tsx`, `unauthorized-view.tsx`; UI `button`, `dialog`, `avatar`, `input`, `skeleton`; `lib/utils.ts`. (`search-list` and `sort-dropdown` imports are commented out.)
- **Packages:** `@dnd-kit/core` and `@dnd-kit/sortable` (drag and drop, `arrayMove`), `axios` (shared task fetch), `react-dom` (`createPortal` for the drag overlay), `next/navigation`, `sonner`, `lucide-react`, `js-cookie` (imported, unused), `react`.

## Used by
`components/athena/ProjectMangement.tsx` (Board tab) and `components/athena/projectmangerbacku.tsx` (backup copy) render `DahboardMangement`. Types / `transformCard` are imported by `AssignedToMe.tsx`, `card-activity.tsx`, `card-modal.tsx`, `kanban-card.tsx` and `kanban-column.tsx` in the same folder (7 importers in total).

## Notes
- Much of the file is dead code: `userData` is never set (so `ShareModal` never renders and `orgId` / `userId` passed down are empty), and `membersharing`, `isMembersModalOpen` and `showExpiredDialog` are never set to true. `activeTab` is always "Board" (the List view is commented out). `onChangeSort`, `teamMembers`, `getAvatarColor`, `fetchMembers` and `toggleTheme` are unused.
- The shared-task effect has an empty dependency list, so it only runs on the first mount; changing `shareTask` without remounting does not refetch.
- `handleDeleteColumn` is memoised with an empty dependency list, so it captures the first render's `boardId` for `decrementListCount`.
- Update and delete of a column do not check `isReadOnly` here; they rely on `KanbanColumn` hiding those controls for observers.
- The social share links hard-code a separate Vercel deployment (`flowboard-new-garage-app.vercel.app`).
