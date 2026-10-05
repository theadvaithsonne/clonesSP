# `components/athena/components/unauthorized-view.tsx`

> A full-screen "Access Denied" card that the Athena Kanban dashboard shows when the user may not view a board.

**Kind:** React component · **Lines:** 40

## Purpose
The Athena / flowboard dashboard loads a board from the external flowboard API. When that load fails with an authorization error, the dashboard replaces the whole board with this view. The view explains the problem and offers two ways out.

## How it works
- It renders a centred white card on a light grey full-height background: a red `ShieldAlert` icon, the heading "Access Denied", and text asking the user to contact the board administrator.
- **Go to Dashboard** calls `router.push('/flowboard')`.
- **Go Back** calls `router.back()`.
- It takes no props and has no state. `LogOut` is imported from `lucide-react` but never used.
- The file has no `"use client"` directive, yet it calls `useRouter`. It works because its only importer, `Dashbaord.tsx`, is a client component.

## Exports
- `UnauthorizedView()` - a named export that takes no props and returns the access-denied screen.

## Dependencies
- **Internal:** none.
- **Packages:**
  - `lucide-react` - the `ShieldAlert` icon (`LogOut` is imported but unused).
  - `next` - `useRouter` from `next/navigation`.

## Used by
- `components/athena/components/Dashbaord.tsx` returns `<UnauthorizedView />` when its board-loading `error` string equals exactly `"Unauthorized for this operation"`.

## Notes
- The match is on the exact message text. If the external flowboard API changes its error message, users will get the generic error path instead of this screen.
- The styling is light-themed (white and gray-50), unlike the dark Athena/taskroom UI around it.
