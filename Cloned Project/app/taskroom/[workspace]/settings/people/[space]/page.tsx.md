# `app/taskroom/[workspace]/settings/people/[space]/page.tsx`

> Next.js page rendered at `/taskroom/[workspace]/settings/people/[space]`.

**Kind:** Next.js page · **Lines:** 882 · **Directive:** `"use client"` · **Route:** `/taskroom/[workspace]/settings/people/[space]` (page)

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Composition

**Renders:** `TableCell`×9 (components/ui/table.tsx), `Button`×7 (components/ui/button.tsx), `TableHead`×6 (components/ui/table.tsx), `TableRow`×5 (components/ui/table.tsx), `DropdownMenuItem`×4 (components/ui/dropdown-menu.tsx), `Dialog`×3 (components/ui/dialog.tsx), `DialogContent`×3 (components/ui/dialog.tsx), `DropdownMenu`×3 (components/ui/dropdown-menu.tsx), `DropdownMenuTrigger`×3 (components/ui/dropdown-menu.tsx), `DropdownMenuContent`×3 (components/ui/dropdown-menu.tsx), `Badge`×3 (components/ui/badge.tsx), `Avatar`×2 (components/ui/avatar.tsx), `AvatarImage`×2 (components/ui/avatar.tsx), `AvatarFallback`×2 (components/ui/avatar.tsx), `User`×2 (lucide-react), `ChevronDown`×2 (lucide-react), `Check`×2 (lucide-react), `Plus`×2 (lucide-react), `Search` (lucide-react), `TableHeader` (components/ui/table.tsx), `TableBody` (components/ui/table.tsx), `Loader2` (lucide-react), `MoreHorizontal` (lucide-react), `ChevronLeft` (lucide-react), `ChevronRight` (lucide-react), `InvitePeopleDialog` (local), `EditPermissionDialog` (local), `RemoveMemberDialog` (local)

**Hooks used:** `useState`×18, `useEffect`×5, `useWorkspaceMemberStore`×4 (store/taskroom/workspaceMemberStore.ts), `useParams`×2 (next/navigation), `useSpaceStore`×2 (store/taskroom/spaceStore.ts), `useRef`, `useCallback`

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `default (PeoplePage)` | component | `PeoplePage()` | 595 |

## Interfaces

- **External HTTP calls:**
  - `GET https://uatapi.garage.app/public/organizations/${garage_org_id}/users?search=${query}` (L192)
- **Other fetch/api calls (target not statically resolvable):**
  - `POST ${process.env.NEXT_PUBLIC_TASKROOM_URL}workspace/members` (L118)
  - `PUT ${process.env.NEXT_PUBLIC_TASKROOM_URL}workspace/members/${member._id}` (L432)
- **Environment variables (`process.env`):** `NEXT_PUBLIC_TASKROOM_URL`
- **Browser storage / cookies:** `garage_tok` (localStorage: get), `garage_org_id` (localStorage: get)
- **Timers / queues:** `setTimeout` at L221, L609
- **External hosts mentioned in the code:** `uatapi.garage.app`

## Dependencies

- **Internal:**
  - `lib/utils.ts` — `cn`
  - `components/ui/button.tsx` — `Button`
  - `components/ui/input.tsx` — `Input`
  - `components/ui/avatar.tsx` — `Avatar`, `AvatarFallback`, `AvatarImage`
  - `components/ui/table.tsx` — `Table`, `TableBody`, `TableCell`, `TableHead`, `TableHeader`, `TableRow`
  - `components/ui/dropdown-menu.tsx` — `DropdownMenu`, `DropdownMenuContent`, `DropdownMenuItem`, `DropdownMenuTrigger`
  - `components/ui/badge.tsx` — `Badge`
  - `components/ui/dialog.tsx` — `Dialog`, `DialogContent`
  - `store/taskroom/workspaceMemberStore.ts` — `useWorkspaceMemberStore`
  - `store/taskroom/spaceStore.ts` — `useSpaceStore`
- **Packages:**
  - `react` — `useState`, `useEffect`, `useCallback`, `useRef`
  - `axios`
  - `js-cookie`
  - `next` — `useParams`
  - `sonner` — `toast`
  - `lucide-react` — `Users`, `Zap`, `Grid`, `Settings`, `Calendar`, `Layers`, …

## Used by

Entry: reached by the Next.js router at `/taskroom/[workspace]/settings/people/[space]` (page).
