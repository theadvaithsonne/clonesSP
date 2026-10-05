# `components/athena/components/kanban-column.tsx`

> One stage (column) of the Athena Kanban board. It is a droppable area that lists its task cards, loads more cards as you scroll, has quick-add task forms at the top and bottom, and a stage menu with edit (name and colour), summary and delete.

**Kind:** React component (client) · **Lines:** 967

## Purpose
On an Athena board (a Taskroom "room"), each stage such as "To do" or "In progress" is rendered by `KanbanColumn`. `Dashbaord.tsx` maps over the sorted stages and renders one column each. It passes the handlers that actually create cards and update or delete stages (`addCard`, `handleUpdateColumn`, `handleDeleteColumn`) together with the board's `setColumns` state setter. The column owns the UI around those actions and the "load more" pagination for its own cards. Each card is a `KanbanCard`.

## How it works

### Props (L51-L73)
- `column` - the stage, including `_id`, `name`, `color`, `cards`, `taskCount` and `localCardCount`.
- `onAddCard(columnId, cardData)` - creates a task.
- `onUpdate?(id, { name, color })` and `onDelete?(id)` - stage edit and delete.
- `boardId`, `orgId`, `userId`, `Idspace`, `setColumns`, `isReadOnly`, `connected`, `updateTaskAndCardCounts` - mostly forwarded to each `KanbanCard`.
- `isOverlay` - applies the dragged-column styling.

### Drag and drop (L110-L123, L745-L764)
- The column root is a `useDroppable` target with `id: column._id` and `data: { type: "Column", column }`.
- The cards sit inside a `SortableContext` that uses `verticalListSortingStrategy`, keyed by card `_id`.
- The drag-end logic lives in the parent `DndContext` in `Dashbaord.tsx`.

### Loading more cards (L155-L286)
Page 1 of every stage is loaded by the board. The column only fetches later pages.
- **Store call:** `useCardStore().fetchCardsForStage(stageId, page)` calls Taskroom `GET stages/detail/:stageId?size&page`.
- **When fetching is allowed (`canFetchMore`):**
  - the stage is not marked exhausted;
  - no fetch is already running (`isFetchingRef`);
  - the last known `totalPages` has not been reached;
  - `column.taskCount > 30`. A stage with 30 tasks or fewer never paginates.
- **Triggers:**
  - a scroll listener, throttled to one check per 300ms, fires a fetch when within 150px of the bottom;
  - a `ResizeObserver` on the content fires a fetch when the content is shorter than 80% of the container, so a short page fills itself.
- **`triggerFetch`:**
  - requests `pageRef + 1`;
  - marks the stage exhausted when the page comes back empty or is the last one;
  - appends the new cards to this column through `setColumns`, after converting them with `transformCard` (server `title` becomes `name`, `assigneeData` becomes `members`, and `TaskDataCount` gets defaults);
  - skips any card id already in the column. Cards created after page 1 loaded shift the server's pages, so the next page can repeat a card.
- The page counter lives in refs, so it resets when the parent remounts the column. `Dashbaord.tsx` keys columns by `${column._id}:${boardLoadId}` for exactly that reason.

### Header and stage menu (L348-L464)
- **Header:** a coloured pill with the stage name (each word capitalised) and `localCardCount`, plus a `+` button that opens the top add form. `+` is hidden for read-only users.
- **`StageSummaryDialog`** is always mounted and opened by the menu's "Summary" item.
- **"More" menu** (hidden for read-only users; closes on an outside `mousedown`):
  - **Edit Stage** - opens the edit popover with the current name and colour.
  - **Summary** - opens `StageSummaryDialog`.
  - **Delete Stage** - first checks the `auth-token` cookie's JWT `exp` claim on the client. An expired token shows a "Session Expired" dialog with a Login button that routes to `/login`. Otherwise it shows a confirmation dialog whose Delete button calls `onDelete(column._id)`.

### Edit Stage popover (L466-L606)
- A name input (Enter saves, Escape closes).
- Twelve `PRESET_COLORS` swatches and a hidden `<input type="color">` for a custom colour, showing the hex value.
- "Save changes" calls `onUpdate(column._id, { name, color })` when the name is not blank. The button takes the selected colour as its background.
- The popover closes on an outside `mousedown`.

### Quick-add task forms (L288-L312, L617-L919)
There are two copies of the form: at the top of the list (opened from the header `+`) and at the bottom (opened from the "Add Task" button). `showAddAtBottom` chooses which one appears.
- **Fields:** title textarea (Enter submits, Escape cancels), `AssigneePicker`, `CustomDatePicker` (start and due timestamps), `PriorityPicker`, `TagPicker` and a description textarea.
- `TagPicker` receives `boardId={resolvedWorkspaceId}`, which is the `workspaceId` URL search parameter when present and otherwise `boardId`.
- **Submit:** `handleAddCard` awaits `onAddCard(column._id, { title, assignedToIds, startDate, dueDate, priority, tags, description })`, then resets the form and closes it. Read-only users cannot submit.
- **Styling:** the stage colour feeds `hexToRgb`, which produces `bgColor` and `borderColor` for the form and picker styling. The same helper exists in `kanban-card.tsx`.

## Exports
- `KanbanColumn(props: KanbanColumnProps)` - the stage column component. The `CommentItem` type and `PRESET_COLORS` are internal; `CommentItem` is never used.

## Interfaces
- **External services:** Taskroom v2 API, indirectly through `store/athena/cardStore.ts` `fetchCardsForStage` (`GET stages/detail/:stageId`). Card creation and stage update/delete happen in the parent's handlers.
- **Browser storage / cookies:** reads the `auth-token` cookie to check JWT expiry before a stage delete.
- **URL parameters:** reads `workspaceId` with `useSearchParams`.

## Dependencies
- **Internal:**
  - `./kanban-card` - `KanbanCard`, one per task.
  - `./Dashbaord` - the `Column` type.
  - `./stage-summary-dialog` - `StageSummaryDialog`.
  - `./assignee-picker`, `./custom-date-picker`, `./priority-picker`, `./tag-picker` - quick-add pickers.
  - `components/ui/dialog.tsx`, `components/ui/button.tsx` - session-expired and delete dialogs.
  - `lib/utils.ts` - `cn`.
  - `store/athena/cardStore.ts` - `fetchCardsForStage`.
- **Packages:**
  - `@dnd-kit/core` - `useDroppable`.
  - `@dnd-kit/sortable` - `SortableContext`.
  - `js-cookie` - reads `auth-token`.
  - `next` - `useRouter` and `useSearchParams`.
  - `react` - state, effects, refs.
  - `sonner` - imported, but no toast is called.
  - `lucide-react` - icons.

## Used by
- `components/athena/components/Dashbaord.tsx` - renders one column per sorted stage.

## Notes
- The add-form "click outside to close" logic checks `addCardContainerRef`, but the ref is commented out on both forms. `addCardContainerRef.current` is therefore always `null`, and the forms only close through Cancel, Escape or a successful submit.
- The top form's date label uses `new Date(startDate)` whenever a due date is set, so it shows 1970-01-01 when only a due date was picked. The bottom form handles that case correctly.
- `handleAddCard` resets the form even if `onAddCard` fails, and it does not catch errors itself.
- `kanban-columnbacvkup.txt` is an older backup copy of this file and is not used.
