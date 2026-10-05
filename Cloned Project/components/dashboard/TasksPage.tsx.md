# `components/dashboard/TasksPage.tsx`

> React component `TasksPage`.

**Kind:** React component · **Lines:** 288 · **Directive:** `"use client"`

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Composition

**Renders:** `DropdownMenuItem`×5 (components/ui/dropdown-menu.tsx), `Button`×3 (components/ui/button.tsx), `Column`×3 (local), `Input`×2 (components/ui/input.tsx), `SelectItem`×2 (components/ui/select.tsx), `TaskDialog`×2 (local), `Dialog` (components/ui/dialog.tsx), `DialogTrigger` (components/ui/dialog.tsx), `DialogContent` (components/ui/dialog.tsx), `DialogHeader` (components/ui/dialog.tsx), `DialogTitle` (components/ui/dialog.tsx), `Select` (components/ui/select.tsx), `SelectTrigger` (components/ui/select.tsx), `SelectValue` (components/ui/select.tsx), `SelectContent` (components/ui/select.tsx), `DropdownMenu` (components/ui/dropdown-menu.tsx), `DropdownMenuTrigger` (components/ui/dropdown-menu.tsx), `MoreHorizontal` (lucide-react), `DropdownMenuContent` (components/ui/dropdown-menu.tsx), `Edit2` (lucide-react), `Trash2` (lucide-react), `Avatar` (components/ui/avatar.tsx), `AvatarFallback` (components/ui/avatar.tsx), `User` (lucide-react), `Calendar` (lucide-react), `TaskCard` (local), `Plus` (lucide-react)

**Hooks used:** `useState`×8, `useEffect`×2, `useCallback`, `useMemo`

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `default (TasksPage)` | component | `TasksPage()` | 188 |

## Interfaces

- **Backend endpoints called (via `/backend`):**
  - `PATCH /backend/tasks/${task._id}` (L121)
  - `GET /backend/tasks` (L197)
  - `GET /backend/team/list` (L198)
  - `POST /backend/tasks` (L216)
  - `DELETE /backend/tasks/${taskId}` (L237)

## Dependencies

- **Internal:**
  - `lib/api.ts` — `api`
  - `lib/auth.ts` — `getToken`
  - `components/ui/button.tsx` — `Button`
  - `components/ui/dialog.tsx` — `Dialog`, `DialogContent`, `DialogHeader`, `DialogTitle`, `DialogTrigger`
  - `components/ui/input.tsx` — `Input`
  - `components/ui/select.tsx` — `Select`, `SelectContent`, `SelectItem`, `SelectTrigger`, `SelectValue`
  - `components/ui/avatar.tsx` — `Avatar`, `AvatarFallback`
  - `components/ui/dropdown-menu.tsx` — `DropdownMenu`, `DropdownMenuContent`, `DropdownMenuItem`, `DropdownMenuTrigger`
- **Packages:**
  - `react` — `useEffect`, `useState`, `useMemo`, `useCallback`
  - `lucide-react` — `Plus`, `Edit2`, `Trash2`, `User`, `Calendar`, `MoreHorizontal`
  - `sonner` — `toast`

## Used by

- `app/(dashboard)/layout.tsx`
