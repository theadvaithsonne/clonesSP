# `components/athena/components/kanban-card.tsx`

> One draggable task card on the Athena Kanban board. It shows the task's name, description, created time, tags, assignee avatars, priority, due date and counters, and opens the full `CardModal` when clicked. The file also contains an inline subtask list with a creation form and a recursive `SubtaskItem` component, both talking to the external Taskroom API.

**Kind:** React component (client) · **Lines:** 1313

## Purpose
Athena is the project-management module: workspaces, then spaces, then rooms (boards), then stages (columns), then tasks (cards). `Dashbaord.tsx` lays out the board, `KanbanColumn` renders each stage, and each task inside a stage is a `KanbanCard`. The card is a `@dnd-kit` sortable item, so tasks can be dragged between stages. `Dashbaord.tsx` also renders one with `isOverlay` inside its `DragOverlay` as the "ghost" shown while a card is being dragged. The card is the entry point to a task's detail view, the `CardModal`.

## How it works

### Props (L54-L67)
- `card`, `columnId`, `columnColor` - the task, the stage it belongs to and that stage's colour.
- `boardId` (the room id), `orgId`, `userId`, `Idspace` (the space id, passed to `TagPicker`).
- `setColumns` - the board's column-state setter, used for optimistic updates.
- `isReadOnly` - true for observers.
- `isOverlay` - true when rendered as the drag ghost.
- `connected` and `updateTaskAndCardCounts` - forwarded to `CardModal`.

### Stage tint (L94-L113)
A local `hexToRgb` turns the stage colour (default `#8b5cf6`) into `bgColor` (a darkened translucent tint) and `borderColor`. These are passed to the pickers in the subtask form so they match the column. The same helper exists in `kanban-column.tsx`.

### Drag and drop (L301-L315, L368-L375)
- `useSortable({ id: card._id, data: { type: "Card", card, columnId } })`. Dragging is disabled for overlays and read-only users, and read-only users also get no drag listeners.
- While the card is being dragged, it renders only a faded 100px placeholder in its slot.
- The parent's `DndContext` in `Dashbaord.tsx` handles drop logic and persistence.

### Card body (L417-L616)
- **Text:** the name and description are shown with each word capitalised. The description is clamped to two lines.
- **Created time:** `card.createdAt` is formatted with `formatCreatedAtDateTime` plus the elapsed time from `formatCreatedAtElapsed`. The tooltip names the viewer's time zone (`getTimeZoneAbbreviation`).
- **Tags:** coloured `tagData` chips, styled by `getTagStyles`.
- **Assignees:** up to five member avatars, using the first image field found (`profilePicture`, `image`, `avatar`, `userAvatarUrl`, `photoUrl`, `photo`) or initials. A `+N` badge appears when `assignedToIds` has more than five entries.
- **Priority:** a flag coloured by priority (urgent red, high amber, normal blue, anything else slate).
- **Due date:** formatted "MMM d" with an "Overdue" marker when `isOverDue` is set.
- **Counters:** comment count, subtask count (when above 0), and the completed/total child counts from `TaskDataCount`.
- Clicking anywhere on the card sets `showModal`. The modal is `<CardModal ... onClose>` (L892), which receives the card, board, org, user, `setColumns`, `isReadOnly`, `connected` and `updateTaskAndCardCounts`.

### Completion toggle (L323-L366), currently not reachable
`handleToggleComplete`:
1. checks the `auth-token` cookie's JWT `exp` claim by base64-decoding its payload, without verifying the signature; if the token has expired it opens a "Session Expired" dialog with a Login button that routes to `/login`;
2. otherwise updates the local state and the board's `setColumns` optimistically;
3. calls `useCardStore().toggleComplete(id, status)`, which sends `PUT <TASKROOM>/complete/:id`;
4. rolls everything back on error.

The button that called it is commented out (L428-L440), so nothing in the UI triggers it.

### Inline subtasks (L74-L91, L151-L295, L618-L823), effectively unreachable
- **Loading:** `fetchSubtasks(page)` calls `GET <TASKROOM>tasks/detail/sub/:taskId?size=30&page=N`, normalises each result into the `Card` shape and appends it. An `IntersectionObserver` on a sentinel div loads the next page.
- **Creating:** `handleSaveSubtask` calls `POST <TASKROOM>tasks` with `{ title, roomId, stageId, assignedToIds, priority (default "normal"), tags, startDate, dueDate, description, parentId: card._id, rootId: card._id }`. On success it prepends the new subtask and updates the parent's `subTaskCount` and `TaskDataCount.totalChildCount` in the board state (`addSubtaskToParentGlobal`, a recursive tree update).
- **The form:** title textarea (Enter saves, Escape closes), `AssigneePicker`, `CustomDatePicker`, `PriorityPicker`, `TagPicker` and a description textarea.
- **Why it cannot be reached:** the section only renders when `isSubtasksVisible` is true. The only code that sets it true is inside `handleSaveSubtask`, and that requires the form, which is itself inside the hidden section. The original toggle on the subtask counter (L589-L596) and the "Add Subtask" hover button (L799-L813) are commented out. As shipped, users manage subtasks in `CardModal` instead.

### `SubtaskItem` (internal, L912-L1312)
A recursive component for one subtask row: title, priority flag, due date, and comment and subtask counts.
- Clicking a row that has children expands it and loads its children with `GET tasks/detail/sub/:subtaskId`, paginated with a sentinel.
- An "Add" control opens the same creation form. It posts with `parentId: subtask._id` and `rootId` set to the root task. On success it increments the root card's counters in the board state.
- Its pickers are rendered without the stage-tint props.

## Exports
- `KanbanCard(props: KanbanCardProps)` - the board card component. `SubtaskItem` and the `CommentItem` type are internal and never used outside this file. `CommentItem` is not used at all.

## Interfaces
- **External services:** Taskroom v2 API at `NEXT_PUBLIC_TASKROOM_URL` (default `https://uatapi.garage.app/taskroomv2/v2/`), not part of this repo:
  - `GET tasks/detail/sub/:id?size=30&page=N` - list a task's subtasks
  - `POST tasks` - create a subtask
  - through `cardStore`, `PUT complete/:id` - toggle completion
- **Environment variables:** `NEXT_PUBLIC_TASKROOM_URL`.
- **Browser storage / cookies:**
  - reads `localStorage["garage_tok"]` as the Taskroom bearer token;
  - reads the `auth-token` cookie only to decode its expiry claim before toggling completion.

## Dependencies
- **Internal:**
  - `./Dashbaord` - the `Card` and `Column` types.
  - `./card-modal` - `CardModal`, the full task detail dialog.
  - `./format-created-at` - created-time formatting and time-zone label.
  - `./assignee-picker`, `./custom-date-picker`, `./priority-picker`, `./tag-picker` - pickers in the subtask form.
  - `./tag-colors` - `getTagStyles` for tag chips.
  - `components/ui/avatar.tsx`, `components/ui/button.tsx`, `components/ui/dialog.tsx`, `components/ui/input.tsx` - UI primitives (`Input` is imported but not used).
  - `lib/utils.ts` - `cn`.
  - `store/athena/cardStore.ts` - `toggleComplete`.
- **Packages:**
  - `@dnd-kit/sortable`, `@dnd-kit/utilities` - sortable item and transform CSS.
  - `axios` - Taskroom requests.
  - `date-fns` - `format` and `isValid` for due dates.
  - `js-cookie` - reads `auth-token`.
  - `next` - `useRouter` from `next/navigation`.
  - `react` - state, effects, refs.
  - `sonner` - toasts.
  - `lucide-react` - icons.

## Used by
- `components/athena/components/kanban-column.tsx` - renders one card per task inside a `SortableContext`.
- `components/athena/components/Dashbaord.tsx` - renders the drag-overlay copy (`isOverlay`).

## Notes
- `console.log("czxczxc32dzxcz", card)` (L386) runs on every render of every card and logs the whole card object, which is noisy on large boards.
- Dead code:
  - `getRootTaskId`, `avatarColors`/`getAvatarColor` and `handleToggleComplete` are defined but never used;
  - several imports (`Calendar`, `Link2`, `MoreHorizontal`, `Check`, `Circle`, `ChevronRight`, `ChevronDown`, `X`, `ArrowLeft`, `Input`) are unused;
  - there is a large commented-out legacy card layout (L825-L889).
- The subtask UI here duplicates logic that lives in `card-modal.tsx` and other subtask components, and as shipped it cannot be opened (see "Inline subtasks").
- The expiry check decodes the JWT on the client without verifying it. It only drives the UI and is not a security control.
- The `+N` overflow badge counts `assignedToIds`, but the avatars come from `members`, so the two can disagree.
