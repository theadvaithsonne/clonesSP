# `app/(dashboard)/flowboard/[symbol]/components/kanban-card.tsx`

> A single draggable card on the Flowboard Kanban board: shows tags, title, description, assignees, overdue state, comment count and checklist progress, toggles completion and opens the card detail modal.

**Kind:** Next.js app-directory module (colocated) · **Lines:** 393

## Purpose

Each card inside a `KanbanColumn` (and the floating card in the board's drag overlay) is a `KanbanCard`. It is mostly presentational, but it also does two things on its own: it marks a card complete or incomplete through the card store, and it opens `CardModal` for full editing. Board data comes from the external Flowboard API (`https://uatapi.garage.app/flowboard/v1`), reached through `store/flowboard/cardStore.ts`.

## How it works

- **Drag and drop:** `useSortable({ id: card._id, data: { type: "Card", card, columnId } })` from `@dnd-kit/sortable`, disabled when the card is rendered as the overlay (`isOverlay`) or the viewer is read-only. Drag listeners are attached only when not read-only. While the card is being dragged, a dashed placeholder box takes its place. `isOverlay` adds a tilt and a stronger shadow.
- **Completion toggle** (`handleToggleComplete`, L82-L125): a round button in the top-right corner, visible on hover. It stops click propagation so the modal does not open, blocks observers ("Observers can only view this board"), and checks the `garage_tok` JWT `exp` claim client-side (an expired token opens a "Session Expired" dialog that routes to `/login`). It then flips `isCompleted` optimistically, both locally and in the parent board's `columns` through `setColumns`, and calls `useCardStore().toggleComplete(card._id, newStatus)` (which does `PUT /flowboard/v1/cards/complete/:id` on the external API). On failure both changes are reverted and an error toast is shown.
- Local `isCompleted` is resynced whenever the `card.isCompleted` prop changes (for example after a `card:updated` socket event handled by the board).
- **Display:**
  - Tag pills use each tag's stored Tailwind class (`label.color`, for example `bg-blue-500`) with white text.
  - Title and description are shown with each word capitalised; the description is clamped to two lines.
  - "Assignees:" shows up to five member initials, plus a `+N` chip based on `assignedToIds.length`.
  - An "Overdue" badge appears when `isOverDue` is true.
  - The footer shows `commentCount` Comments and checklist progress as `totalCompletedChildCount/totalChildCount` from `TaskDataCount`.
- **Modal:** clicking the card sets `showModal`, which renders `CardModal` with the same props the board uses (`connected`, `updateTaskAndCardCounts`, `boardId`, `orgId`, `setColumns`, `isReadOnly`, `userId`).

## Exports
- `KanbanCard(props: KanbanCardProps)` - props: `card: Card`, `columnId`, `isOverlay?`, `boardId`, `orgId`, `setColumns` (setter for the board's `Column[]`), `userId`, `isReadOnly?`, `connected` (board socket flag), `updateTaskAndCardCounts(newChildCount, newCompletedChildCount, taskId, cardId)`.

## Interfaces
- **External services:** Flowboard API `PUT https://uatapi.garage.app/flowboard/v1/cards/complete/:id`, called through `cardStore.toggleComplete`.
- **Browser storage / cookies:** reads `localStorage.garage_tok` for the expiry check.

## Dependencies
- **Internal:** `./kanban-board` (`Card`, `Column` types), `./card-modal` (detail modal), `store/flowboard/cardStore` (`toggleComplete`), `components/ui/{avatar,button,dialog}`.
- **Packages:** `@dnd-kit/sortable`, `@dnd-kit/utilities` (`CSS.Transform`), `sonner` (toasts), `lucide-react` (icons), `next/navigation` (router), `react`. `js-cookie` is imported but unused.

## Used by
`kanban-column.tsx` (one per card) and `kanban-board.tsx` (inside the `DragOverlay`). These render on the route `/flowboard/<boardId>`.

## Notes
- The `avatarColors` array, the `initials`/`bg`/`randomColor` variables, the unused `CommentItem` type and the large commented-out legacy card markup (L307-L371) are dead code.
- A `console.log` of the whole card runs on every render.
- The variables `textColor` and `lightBg` in the tag renderer are computed but never used.
