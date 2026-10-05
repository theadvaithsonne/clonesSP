# `app/(dashboard)/taskroom/all-taskrooms/components/SkeletonCard.tsx`

> Pulsing placeholder card shown in the TaskRooms grid while the room list is loading.

**Kind:** Next.js app-directory module (colocated) · **Lines:** 52

## Purpose
Mirrors the layout of `TaskRoomCard` (colour dot and title, two description lines, progress bar, footer with two icon+label pairs) so the grid does not jump when real data arrives.

## How it works
Pure presentational component with no props, state or effects. It renders grey `animate-pulse` blocks on the same `#1e1e2d` card background and `border-gray-800` border as the real card. One header block is only revealed on hover (`opacity-0 group-hover:opacity-100`), mimicking the hidden three-dot menu of the real card.

## Exports
- `default SkeletonCard()` - the skeleton card element.

## Dependencies
- **Packages:** `react` - JSX.

## Used by
- `app/(dashboard)/taskroom/all-taskrooms/components/AllTaskroomDashbaord.tsx` - renders eight of them while `isLoading` is true.
