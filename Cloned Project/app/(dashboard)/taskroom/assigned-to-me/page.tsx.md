# `app/(dashboard)/taskroom/assigned-to-me/page.tsx`

> Next.js page rendered at `/taskroom/assigned-to-me`.

**Kind:** Next.js page · **Lines:** 693 · **Directive:** `"use client"` · **Route:** `/taskroom/assigned-to-me` (page)

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Composition

**Renders:** `Badge`×4 (components/ui/badge.tsx), `Clock`×3 (lucide-react), `Button`×3 (components/ui/button.tsx), `AlertCircle`×2 (lucide-react), `Search`×2 (lucide-react), `DropdownMenu`×2 (components/ui/dropdown-menu.tsx), `DropdownMenuTrigger`×2 (components/ui/dropdown-menu.tsx), `ChevronDown`×2 (lucide-react), `DropdownMenuContent`×2 (components/ui/dropdown-menu.tsx), `DropdownMenuItem`×2 (components/ui/dropdown-menu.tsx), `Input` (components/ui/input.tsx), `TaskSkeleton` (local), `EditTaskRoom` (app/(dashboard)/taskroom/assigned-to-me/components/edit-task-dialog.tsx)

**Hooks used:** `useState`×17, `useEffect`×3, `useMemo`×2, `useRef`, `useRouter` (next/navigation), `useCallback`

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `default (Page)` | component | `Page()` | 52 |

## Interfaces

- **Backend endpoints called (via `/backend`):**
  - `GET /backend/public/organizations/${orgId}/users` (L90)
- **External HTTP calls:**
  - `GET uatapi.garage.app/v1/tasks/assigned/${id}?size=50&page=${page}` (L134)
  - `GET uatapi.garage.app/v1/stages?roomId=${roomId}&status=active&size=50` (L285)
- **Environment variables (`process.env`):** `NEXT_PUBLIC_API_URL`
- **Browser storage / cookies:** `garage_org_id` (localStorage: get), `garage_tok` (localStorage: get)
- **External hosts mentioned in the code:** `uatapi.garage.app`

## Dependencies

- **Internal:**
  - `components/ui/input.tsx` — `Input`
  - `components/ui/button.tsx` — `Button`
  - `components/ui/dropdown-menu.tsx` — `DropdownMenu`, `DropdownMenuContent`, `DropdownMenuItem`, `DropdownMenuTrigger`, `DropdownMenuLabel`
  - `app/(dashboard)/taskroom/assigned-to-me/types/kanban.ts` — `Task`, `Employee`, `Subtask`, `(types only)`
  - `components/ui/badge.tsx` — `Badge`
  - `app/(dashboard)/taskroom/assigned-to-me/components/edit-task-dialog.tsx` — `EditTaskRoom`
  - `lib/api-config.ts` — `buildExternalUrl`
  - `utils/api.ts` — `authenticatedFetch`
- **Packages:**
  - `react` — `useEffect`, `useState`, `useMemo`, `useRef`, `useCallback`
  - `next` — `useRouter`
  - `js-cookie`
  - `sonner` — `toast`
  - `lucide-react` — `Search`, `Filter`, `Calendar`, `Tag`, `AlertCircle`, `Clock`, …
  - `jwt-decode` — `jwtDecode`

## Used by

- `app/(dashboard)/layout.tsx`

Entry: reached by the Next.js router at `/taskroom/assigned-to-me` (page).
