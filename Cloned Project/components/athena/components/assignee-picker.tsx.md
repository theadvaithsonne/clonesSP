# `components/athena/components/assignee-picker.tsx`

> A popover that lists the members of the current Taskroom room (searchable, infinitely scrolled) and lets the user toggle them as task assignees.

**Kind:** React component · **Lines:** 259

## Purpose
Athena tasks can be assigned to several room members. Kanban cards, the list view, Gantt rows, subtasks and the create-task dialog all need the same "pick assignees" UI, so this component wraps any trigger element (`children`) in a Radix popover that fetches room members from the external Taskroom API and reports the selected IDs back.

## How it works
- **Room ID:** `roomId` prop, else the `roomId` query parameter on shared-task URLs (`?shareTask=...`), else `currentRoomDetail._id` from `useTaskroomWorkspacetore`.
- **Fetching (`fetchMembers`):** `GET {NEXT_PUBLIC_TASKROOM_URL}room/members?roomId=&search=&page=&size=25` with `Authorization: Bearer <localStorage.garage_tok>`. Each member is normalised into a `User` (`_id`, `name`, `email`, two-letter `initials`, fallback `color`, and an `image` picked from many possible avatar fields). `metadata.totalPages` is stored. Page 1 replaces the list; later pages are appended with de-duplication by `_id`.
- **Lifecycle:** while open, a 300ms debounced effect resets to page 1 and refetches whenever `search` changes. Closing clears the search and list.
- **Infinite scroll:** the list's `onScroll` handler loads `page + 1` when within 10px of the bottom and not already loading, while `page <= totalPages`.
- **Toggling:** clicking a user adds or removes their ID from `assignedToIds` and calls `onSelect(newIds)`. The component is controlled: it never stores the selection itself.
- **Theming:** a scoped `<style>` block (class names derived from `React.useId`) applies hover/assigned/focus colours from the optional `bgColor`, `borderColor` and `activeColor` props, defaulting to `--brand` mixes. Assigned users get a green badge on the avatar and a refresh icon. Broken avatar images fall back to the initials circle.

## Exports
- `AssigneePicker(props: AssigneePickerProps)` - props: `assignedToIds?: string[]`, `onSelect(ids: string[])`, `children` (trigger), `roomId?`, `activeColor?`, `bgColor?`, `borderColor?`, `contentClassName?` (default `"bg-[#0a0a0d]"`).
- `interface User` - normalised member shape (`_id`, `name`, `email?`, `initials`, `color`, `avatar?`, `image?`).

## Interfaces
- **External services:** Taskroom API `GET room/members` (`NEXT_PUBLIC_TASKROOM_URL`).
- **Environment variables:** `NEXT_PUBLIC_TASKROOM_URL` - Taskroom API base (no fallback here).
- **Browser storage:** `localStorage.garage_tok` - bearer token.

## Dependencies
- **Internal:** `components/ui/popover.tsx`, `lib/utils.ts` (`cn`), `store/taskroom/taskroomWorkspace.tsx` (`currentRoomDetail`).
- **Packages:** `axios`, `lucide-react`, `next/navigation` (`useSearchParams`), `react`.

## Used by
- `components/athena/components/CreateTaskDialog.tsx`
- `components/athena/components/Gantt.tsx`
- `components/athena/components/ListView.tsx`
- `components/athena/components/kanban-card.tsx`
- `components/athena/components/kanban-column.tsx`
- `components/athena/components/subtaskCompoent.tsx`

## Notes
- A leftover `console.log("page <= totalPages", ...)` runs on every render.
- The `page <= totalPages` check allows one extra request past the last page (it should be `<`); the extra page returns no new users.
- The search placeholder says "Search or enter email..." but there is no invite-by-email behaviour; it only filters room members.
