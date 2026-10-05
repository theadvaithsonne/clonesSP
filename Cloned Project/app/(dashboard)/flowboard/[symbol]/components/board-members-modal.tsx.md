# `app/(dashboard)/flowboard/[symbol]/components/board-members-modal.tsx`

> Read-only "Board Members" overlay for a Flowboard board: lists the board's members with role badges, a debounced search box and infinite scroll.

**Kind:** Next.js app-directory module (colocated) · **Lines:** 210

## Purpose
Flowboard is the Trello-style kanban feature of the app, served by the external Flowboard service at `https://uatapi.garage.app/flowboard`, not by this repo's Express backend. This client component is the modal opened from the board header (and the list view's code) to show who has access to the current board. It only displays members. Adding, removing or changing roles happens elsewhere (for example in `share-modal.tsx` through the same member store).

## How it works
- **Data source:** all state lives in the zustand store `useMemberStore` (`store/flowboard/memberStore.ts`). The component reads `members`, `isLoading`, `isLoadingMore` and `pagination` from it, and calls `fetchMembers` and `loadMoreMembers`.
- **Initial load:** a `useEffect` calls `fetchMembers(boardId, 1, "")` whenever `boardId` changes. On page 1 the store clears `members` and `pagination` before it fetches.
- **Search:** typing updates local `searchQuery`. A 500 ms debounce (a `setTimeout` kept in `searchTimeout`) then calls `fetchMembers(boardId, 1, query)`, which restarts paging with the search term.
- **Infinite scroll:** `lastMemberElementRef` is a callback ref attached to the last member row. It sets up an `IntersectionObserver`. When that row scrolls into view it calls `loadMoreMembers(boardId, searchQuery)`. The store picks the next page from `pagination.nextPage`, or from `currentPage < totalPages` if that is missing, and does nothing while a load is already running.
- **Rendering:**
  - While the first page loads and the list is empty, it shows five skeleton rows.
  - Each member row shows an avatar. It uses `member.user.avatar` if present; otherwise it shows a blue circle with the first letter of `member.userId.name`, where `userId` is the populated user object.
  - The row also shows the name, the email (or "No email"), a "You" pill when `user._id === userId`, and a role badge.
  - The badge colour comes from `getRoleBadge(role)` (admin, owner, member, viewer, or a grey fallback).
  - An empty state appears when nothing is found, and a trailing skeleton row appears while more members load.
- The count chip shows `pagination.count`, falling back to `members.length`.

## Exports
- `BoardMembersModal({ onClose, boardId, userId }: BoardMembersModalProps)` - the modal component. `onClose` dismisses it, `boardId` is the Flowboard board id, and `userId` is the current user's id, used for the "You" marker.

## Interfaces
- **External services:** Flowboard API, called through `useMemberStore.fetchMembers`: `GET https://uatapi.garage.app/flowboard/v1/members?boardId=…&size=50&page=…[&search=…]` with `Authorization: Bearer <garage_tok>`.
- **Browser storage / cookies:** none directly. The store reads `localStorage.garage_tok`.

## Dependencies
- **Internal:** `store/flowboard/memberStore.ts` - member list, pagination and fetch actions. `components/ui/skeleton.tsx` - loading placeholders.
- **Packages:** `react` - hooks; `lucide-react` - `X` and `Users` icons.

## Used by
- `app/(dashboard)/flowboard/[symbol]/components/kanban-board.tsx` - renders it when `isMembersModalOpen` is true.
- `app/(dashboard)/flowboard/[symbol]/components/kanban-board-list-view.tsx` - imports it but never renders it.
- Reached in the browser at `/flowboard/[symbol]` (the board page).

## Notes
- `avatarColors` and `colorIndex` are computed but never used. Every fallback avatar is `bg-blue-800`.
- The `useCallback` dependency list for `lastMemberElementRef` leaves out `searchQuery`. The observer callback keeps the search term from when the ref was last rebuilt, so scrolling right after a new search can load the next page for the old term.
- Clicking the backdrop does not close the modal; only the X button does.
