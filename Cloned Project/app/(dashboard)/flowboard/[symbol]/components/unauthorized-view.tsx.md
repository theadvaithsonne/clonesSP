# `app/(dashboard)/flowboard/[symbol]/components/unauthorized-view.tsx`

> A full-screen "Access Denied" panel shown when the current user is not allowed to view a Flowboard board.

**Kind:** Next.js app-directory module (colocated) · **Lines:** 40

## Purpose
The Flowboard board views decide whether the signed-in user has access to the board identified by the `[symbol]` URL segment. When they do not, they return this component instead of the board. It keeps the denial screen consistent between the Kanban and list views.

## How it works
Renders a centred white card on a grey full-height background with a red `ShieldAlert` icon, the heading "Access Denied" and a short message asking the user to contact the board administrator. Two buttons use the Next.js router:
- **Go to Dashboard** - `router.push('/flowboard')`, back to the board list.
- **Go Back** - `router.back()`.

It has no props, no state and no data fetching. The file has no `"use client"` directive of its own; it uses `useRouter`, so it only works when imported from client components (which both importers are).

## Exports
- `UnauthorizedView()` - the access-denied component.

## Dependencies
- **Packages:** `lucide-react` - `ShieldAlert` icon (`LogOut` is imported but unused); `next` - `useRouter` from `next/navigation`.

## Used by
- `app/(dashboard)/flowboard/[symbol]/components/kanban-board.tsx` - returned when board access is denied.
- `app/(dashboard)/flowboard/[symbol]/components/kanban-board-list-view.tsx` - same, for the list view.

Both are part of the `/flowboard/[symbol]` page.

## Notes
- Colours are fixed light-theme Tailwind classes; it ignores the Flowboard dark theme set in `app/(dashboard)/flowboard/layout.tsx`.
