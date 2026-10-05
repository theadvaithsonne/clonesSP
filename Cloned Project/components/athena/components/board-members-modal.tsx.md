# `components/athena/components/board-members-modal.tsx`

> A read-only full-screen modal listing a Flowboard board's members with search, role badges and infinite scroll.

**Kind:** React component · **Lines:** 210

## Purpose
The Athena dashboard (`Dashbaord.tsx`) shows boards backed by the external Flowboard service. This modal answers "who has access to this board?": it lists members with their role and highlights the current user. It does not add, edit or remove members.

## How it works
- On mount (and when `boardId` changes) it calls `useMemberStore.fetchMembers(boardId, 1, "")`. In `store/athena/memberStore.ts` that requests `https://uatapi.garage.app/flowboard/v1/members?boardId=...&size=50&page=...` (plus search).
- **Search:** typing updates `searchQuery` and, after a 500ms debounce, refetches page 1 with the query.
- **Infinite scroll:** a callback ref is attached to the last member row; an `IntersectionObserver` calls `loadMoreMembers(boardId, searchQuery)` when it becomes visible. The observer is skipped while `isLoadingMore`.
- **Rendering:** header with close button; member count from `pagination.count` (falls back to list length); 5 skeleton rows while the first page loads; each row shows an avatar image (`member.user.avatar`) or an initial circle, name and email from `member.userId` when it is a populated object, a "You" pill when `userId` matches, and a coloured role badge (`getRoleBadge`: admin, owner, member, viewer). Empty and loading-more states are included.

## Exports
- `BoardMembersModal({ onClose, boardId, userId })` - `onClose` closes the modal; `boardId` is the Flowboard board; `userId` is the current user's ID for the "You" tag.

## Interfaces
- **External services:** Flowboard members API at `uatapi.garage.app/flowboard/v1/members` (via `useMemberStore`).

## Dependencies
- **Internal:** `store/athena/memberStore.ts` (`members`, `isLoading`, `isLoadingMore`, `pagination`, `fetchMembers`, `loadMoreMembers`), `components/ui/skeleton.tsx`.
- **Packages:** `react`, `lucide-react`.

## Used by
- `components/athena/components/Dashbaord.tsx`

## Notes
- `lastMemberElementRef`'s dependency list omits `searchQuery`, so the observer can call `loadMoreMembers` with a stale search string after the query changes.
- The avatar image reads `member.user.avatar` while name/email read `member.userId`; if the API only populates `userId`, every row falls back to the initial circle.
- `avatarColors` is computed per row (`colorIndex`) but never applied; all fallback avatars are `bg-blue-800`.
- The modal uses light/dark Tailwind palette classes, unlike the dark-only styling of most other Athena components.
