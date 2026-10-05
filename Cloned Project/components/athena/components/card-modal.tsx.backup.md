# `components/athena/components/card-modal.tsx.backup`

> An old, uncompiled backup copy of the Athena (project-management) board's card detail modal, `CardModal`, from the period when it talked to the external "flowboard" API.

**Kind:** React component (backup snapshot, not compiled) · **Lines:** 2530

## Purpose
This file is a frozen copy of an earlier version of `components/athena/components/card-modal.tsx`, the modal that opens when a user clicks a card on an Athena Kanban board. It was kept by hand as a safety net while the live modal was being rewritten. Because its extension is `.tsx.backup`, neither TypeScript nor Next.js/Turbopack picks it up: it is never compiled, bundled or imported. It is worth reading only to understand how the card modal used to work, or to recover old logic. The live component is `card-modal.tsx` in the same folder, and it differs a lot from this copy (see Notes).

## How it works
The file defines two React function components: the exported `CardModal` (L81-L1883) and a private `TaskItem` sub-component (L1886-L2529). Both are client components (`"use client"`). They read and write board data through the Athena zustand stores and through direct `fetch` calls to the external flowboard API at `https://uatapi.garage.app/flowboard/v1/...`. That API is not part of this repo. Every direct call sends `Authorization: Bearer <token>`, where the token is the `auth-token` cookie read with `js-cookie`.

### Props and store wiring (L35-L148)
- `CardModalProps` carries the `card` (type `Card` from `./Dashbaord`), `boardId`, `orgId`, `userId`, `onClose`, the parent board's `setColumns` state setter, `isReadOnly`, the socket `connected` flag and an `updateTaskAndCardCounts` callback. The component destructures `updateTaskAndCardCounts` but never calls it. `orgId` and `columnId` are not used either.
- Stores used: `useMemberStore` (board members, card members, assigned members, `fetchAssignForCards`, `fetchMembersForCards`, `setAssignedMembers`, `removeAssignedMember`, `removeMembersForCards`), `useCardStore` (`updateCard`, `deleteCard`, `toggleComplete`), `useTaskStore` (tasks for the card, paging and `createTask`), `useTagStore` (`createTag`, `updateTag`), `useBoardStore` (`decrementCardCount`) and `useChecklistStore`. The checklist store is destructured but its checklist values are only used for an unused progress number.
- `LABEL_COLORS` (L68-L79) is the 10-colour palette of Tailwind background classes offered when a user creates a label.

### Local state and sync effects (L130-L366)
- The card name, description, completion flag, start/due dates and attachments are copied from `card` into local state. `useEffect` hooks copy them again whenever the matching `card` field changes (L315-L343).
- On mount, `fetchTasks(card._id, 1, false)` loads the first page of the card's tasks (L149-L154). A second effect (L159-L177) adds up `childCount` / `completedChildCount` across the loaded tasks and writes the totals into the card's `TaskDataCount` inside `setColumns`, so the Kanban card's checklist badge stays correct.
- `handleTaskScroll` (L182-L196) loads more tasks: when the modal body scrolls within 100 px of the bottom and the store says `hasMore`, it fetches the next page and appends it.
- `fetchAssignForCards(card._id)` loads the members assigned to the card (L235-L237).
- Member search (L240-L313) waits 300 ms after typing stops, then calls `GET /flowboard/v1/cards/:cardId/members?size=50&search=...`. It flattens results to `{ _id, id, name, email, userId }` whether or not the API nests them under `userData`.
- When the Labels popover opens, the board's tags are fetched from `GET /flowboard/v1/tags?boardId=...&size=100` (L345-L366).

### Session-expiry guard (repeated)
Almost every mutating handler starts with the same inline block. It base64-decodes the JWT payload from the `auth-token` cookie, compares `exp` with the current time and, if the token has expired, opens a "Session Expired" dialog instead of continuing. The dialog's Login button routes to `/login` (L956-L970). `blockIfReadOnly()` (L213-L217) runs before this check: it shows a toast ("Observers can only view cards") and stops the action when `isReadOnly` is true.

### Card mutations (L368-L889)
Each handler calls the store or API, then patches the matching card inside `setColumns` so the board updates without a refetch.
- `handleCommentCountChange(diff)` - changes `commentCount` by `diff`. `CardActivity` calls it.
- `handleToggleComplete` - flips `isCompleted` optimistically, calls `toggleComplete`, and reverts if the call fails.
- `toggleMember(member)` - adds a member. It builds the new `assignedToIds` list, calls `updateCard(card._id, { assignedToIds, socketId, userAssignedToIds })`, removes the member from the picker list (`removeMembersForCards`) and adds them to the assigned list. Only one toggle can run at a time, enforced by `togglingMemberIds`. Despite the name, this function never removes a member; removal is done by the hover "X" on each avatar (L1111-L1179), which calls `updateCard` with `userRemoveAssignedToIds`.
- `handleDelete` - asks for confirmation with `confirm()`, calls `deleteCard(card._id, card.stageId)`, removes the card from its column, lowers `localCardCount`, calls `decrementCardCount(boardId)` and closes the modal.
- `handleSaveDesc` - saves the description through `updateCard` only when it changed.
- Dates (L543-L661): `applyDateUpdate` sends `startDate` / `dueDate` as epoch milliseconds (start of day for the start date, 23:59:59.999 for the due date) or `null`. `handleSaveDates` checks that each enabled date is set and that the due date is not before the start date. `handleRemoveDates` sets both to `null`.
- Labels (L663-L821): `handleToggleTag` only adds a tag (it shows "Already this label is selected" if the tag is already on the card) and sends `tags` plus `tagItemIds`. `handleCreateLabel` either renames or recolours an existing tag (`updateTag`, then patches `tagData` on every card that uses it) or creates one (`createTag`). `handleDeleteTag` only removes the tag from local state: the real `deleteTagApi` call is commented out, so the server keeps the tag.
- `handleSaveAttachments` (L823-L889) sends `POST /flowboard/v1/files/bulk` with `{ boardId, cardId, attachments: [{ fileLink, fileName, fileType }] }`, then stores the new attachments on the card. When the server returns an error it only shows the message as a toast, then still updates local state and shows "Attachments saved successfully".
- `getDueDateWithStatus` (L924-L950) formats the due date in the `en-IN` locale and adds " (overdue)" when the date has passed.

### Layout (L952-L1882)
- The modal is a full-screen dark overlay; clicking the backdrop calls `onClose`. The panel is `max-w-[50vw]` and `h-[80vh]`, scrolls internally and has an "X" close button. `handleModalClick` blurs any focused input when the user clicks empty space inside the panel.
- Header: an inline title input that saves on blur with `updateCard(card._id, { name })`.
- Left column: assigned-member avatars (skeletons while loading, hover "X" to remove), label chips (hover "X" to remove, via `updateCard` with the reduced `tags` array), the due date, the description editor, `CardAttachments`, a list of `TaskItem`s (one per task), and `CardActivity` (comments and activity feed).
- Right column, "Add to card": popovers for Members (search box plus card-member list), Labels (search, create/edit view with the colour grid), Task (creates a task with `createTask(card._id, name, "boardSocketService.socketId")`), Dates (checkbox-enabled start and due date inputs, with `min` set to today or to the start date), and an Attachment button that sets `showAttachments`. An "Actions" section holds Mark Complete and Delete.

### `TaskItem` sub-component (L1886-L2529)
Renders one task as a checklist group with a progress bar and its items.
- Starting state comes from `task.checklistData` plus local counts (`childCount`, `completedChildCount`), and is reset when those props change.
- It defines a local `updateTaskAndCardCounts` (L1950-L1990) that recomputes the card totals from `tasks` in the store, but nothing calls it. Each handler adjusts `TaskDataCount` by plus or minus one instead.
- `handleAddItem` - `POST /flowboard/v1/tasks/:taskId/checklists` with `{ description, socketId }`.
- `handleToggle` - `PUT /flowboard/v1/tasks/checklists/:itemId/complete` with `{ isCompleted }`. Only one toggle can run at a time.
- `handleDeleteItem` - `DELETE /flowboard/v1/tasks/checklists/:itemId`.
- `handleLoadMoreChecklists` - `GET /flowboard/v1/tasks/checklists/?size=10&page=N&boardId=...&taskId=...`. It uses `metadata.currentPage` / `totalPages` to decide whether more pages exist. The "Load More" button only appears when `taskchild.childCount > 10`.
- `saveEditingItem` - updates the item locally first, then sends `PUT /flowboard/v1/tasks/checklists/:itemId` with `{ description }`. It does not check the response.
- `handleSaveTitle` calls `updateTask(task._id, { name })`. Task deletion calls `deleteTask(task._id, "boardSocketService.socketId")` after a `confirm()`.
- A large commented-out block (L1992-L2059) used to subscribe to `checklist:created` / `checklist:updated` / `checklist:deleted` events on a `boardSocketService`. It is inactive.

## Exports
- `CardModal(props: CardModalProps)` - the card detail modal described above. It is a named export; there is no default export. Because the file is never compiled, nothing can import it.

`TaskItem`, `CardModalProps`, `ChecklistItem` and `CommentItem` are module-private.

## Interfaces
- **Backend endpoints called:** none in this repo. All direct calls go to the external flowboard service (see below). Store methods (`updateCard`, `deleteCard`, `toggleComplete`, task/tag/member methods) make their own requests as written in the current `store/athena/*` files.
- **External services:** `https://uatapi.garage.app/flowboard/v1` -
  - `GET cards/:cardId/members` - search card members
  - `GET tags` - list board tags
  - `POST files/bulk` - save attachments
  - `POST tasks/:taskId/checklists` - add a checklist item
  - `PUT tasks/checklists/:itemId/complete` - toggle an item
  - `PUT tasks/checklists/:itemId` - edit an item's text
  - `DELETE tasks/checklists/:itemId` - delete an item
  - `GET tasks/checklists/` - next page of items
- **Browser storage / cookies:** reads the `auth-token` cookie (bearer token, and JWT `exp` for the session-expiry check).

## Dependencies
- **Internal:** `./Dashbaord` (`Card`, `Column` types); `./card-activity` (`CardActivity`); `./card-attachments` (`CardAttachments`, `Attachment`); `@/store/athena/memberStore`, `cardStore`, `taskStore`, `tagStore`, `boardStore`, `checklistStore`; `@/components/ui/popover`, `skeleton`, `dialog`, `button`.
- **Packages:** `react`; `lucide-react` (icons); `sonner` (toasts); `date-fns` (`format`; `formatDistanceToNowStrict`, `isPast` and `enIN` are imported but unused); `js-cookie` (reads the token); `next/navigation` (`useRouter`).

## Used by
Nothing. No importers were found, and the `.backup` extension keeps the file out of the TypeScript/Next.js build. The live `CardModal` in `card-modal.tsx` is the one imported by `Dashbaord.tsx`, `kanban-card.tsx`, `ListView.tsx`, `CalendarView.tsx`, `AssignedToMe.tsx` and `subtaskCompoent.tsx`.

## Notes
- **Dead or stale code.** This snapshot targets the flowboard v1 API and the `auth-token` cookie. The live `card-modal.tsx` has moved to the taskroom API (`NEXT_PUBLIC_TASKROOM_URL`, default `https://uatapi.garage.app/taskroomv2/v2/`), reads the token from `localStorage` key `garage_tok`, and adds `StatusPicker`, `SubtaskManager`, room context and short URLs. Do not copy logic from this backup without checking it against the current stores: for example, `cardStore.updateCard` now calls the taskroom `tasks/:id` endpoint, not flowboard.
- Placeholder socket ids: several calls send the literal string `"boardSocketService.socketId"` (sometimes with stray spaces) as `socketId`, left over from a removed socket service.
- Label deletion never reaches the server (the API call is commented out). Attachment-save errors still show a success toast.
- The session-expiry check is pasted roughly 12 times instead of being a helper. The later backup (`cardmodelnewbackup.txt`) moves it into `checkToken()`.
- Many leftover `console.log` debug lines (for example L91, L126, L542, L923) print whole card objects.
- The JWT is decoded on the client only to read `exp`; this is not a security check.
