# `components/athena/components/members-table.tsx`

> Shared building blocks for the member tables in Athena (workspace people, room members, space members): column definitions, a scrollable table shell with a sticky header, row and cell components, avatar, owner badge, action buttons and skeleton rows.

**Kind:** React component module (client) · **Lines:** 280

## Purpose
Several Athena screens list people with the same columns: name, email, member type, status and actions, sometimes with a selection checkbox. The workspace People dashboard, the members view and the room and space member dialogs all build their tables from these primitives, so the styling and responsive behaviour stay the same everywhere. The module only renders. It fetches nothing and keeps no state; the callers supply the rows, the data and the action menus.

## How it works
- **Column registry (`MEMBER_COLUMNS`):** maps each `MemberColumnKey` (`select`, `name`, `email`, `role`, `status`, `actions`) to a header label and matching `th`/`td` classes.
  - The name column grows to fill the space; the others have fixed or percentage widths.
  - Email is hidden below `md` and Status below `sm`. On small screens the email is shown under the name instead (see `MemberNameCell`).
  - The labels are "Employee Name", "Email ID", "Member Type", "Status" and "Actions".
- **Table shell (`MembersTable`):**
  - a scrollable container in both directions (`overscroll-contain`), holding a fixed-layout table with a configurable `minWidth` (default 640px);
  - draws header cells for the given `columns` in order, sticky at the top;
  - places the caller's `children` in `<tbody>`;
  - attaches `scrollRef` to the scroll container, so callers can use it as the root of an `IntersectionObserver` for infinite scrolling.
- **Rows and cells:**
  - `MemberTableRow` - a hoverable row, with a pointer cursor when `onClick` is given.
  - `MemberNameCell` - avatar plus name (capitalised, `—` when missing), an optional `badge`, and on mobile the email underneath.
  - `MemberEmailCell` - the email, or `—`.
  - `MemberRoleCell` - the role with its first letter capitalised. It accepts a `roleClassName` prop but ignores it (the prop is renamed to `_roleClassName`).
  - `MemberStatusCell` - an emerald pill when the status is `active` (any case), otherwise a neutral pill.
  - `MemberActionsCell` and `MemberSelectCell` - cells with the right column classes that wrap whatever the caller passes.
- **Small pieces:**
  - `MemberAvatar` - uses the first of `profilePicture` / `image` / `avatar`, otherwise initials. `getInitials` takes the first two characters of the name in upper case, or `??`.
  - `MemberActionTrigger` - a square 32px button with a forwarded ref, intended as the trigger for a `⋯` dropdown.
  - `MemberQuickAddButton` - a text button that defaults to "Quick Add" and is disabled while `loading`.
  - `OwnerBadge` - a small "Owner" `Badge`.
  - `MemberTableSkeletonRows({ cols, count = 6 })` - pulsing placeholder rows shown while data loads.

## Exports
- `MemberColumnKey` - `"select" | "name" | "email" | "role" | "status" | "actions"`.
- `MEMBER_COLUMNS` - `Record<MemberColumnKey, { label, thClass, tdClass }>`.
- `getInitials(name?: string): string` - two-letter initials, or `"??"`.
- `MemberAvatar({ userData, size? = "sm" | "md" })` - avatar with image or initials.
- `MemberActionTrigger` - `forwardRef` button for row action menus.
- `MemberQuickAddButton` - `forwardRef` button with a `loading` prop.
- `MembersTable({ columns, children, className?, minWidth? = 640, scrollRef? })` - table shell with sticky header.
- `MemberTableRow({ children, className?, onClick? })` - table row.
- `MemberNameCell({ userData, badge? })`, `MemberEmailCell({ email? })`, `MemberRoleCell({ role?, roleClassName? })`, `MemberStatusCell({ status? })`, `MemberActionsCell({ children })`, `MemberSelectCell({ children })` - cells.
- `OwnerBadge()` - "Owner" badge.
- `MemberTableSkeletonRows({ cols, count? = 6 })` - loading rows.

## Dependencies
- **Internal:**
  - `components/ui/avatar.tsx` - `Avatar`, `AvatarImage`, `AvatarFallback`.
  - `components/ui/badge.tsx` - `Badge` for the owner tag.
  - `lib/utils.ts` - `cn` for joining class names.
- **Packages:** `react` - components and `forwardRef`.

## Used by
- `components/athena/components/WorkspacePeopleDashboard.tsx`
- `components/athena/components/members-view.tsx`
- `components/athena/components/room-members-dialog.tsx`
- `components/athena/components/space-members-dialog.tsx`

## Notes
- `userData` is typed as `any`, so nothing checks the shape of the member objects passed in.
- Cells must be rendered in the same order as the `columns` array passed to `MembersTable`. Nothing enforces this, and a mismatch puts data under the wrong headers.
