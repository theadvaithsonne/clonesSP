# `app/taskroom/components/task-stage-template-dialog.tsx`

> React component `TaskStageTemplateDialog`.

**Kind:** Next.js app-directory module (colocated) · **Lines:** 547 · **Directive:** `"use client"`

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Composition

**Renders:** `Button`×5 (components/ui/button.tsx), `Input`×3 (components/ui/input.tsx), `Plus`×3 (lucide-react), `SelectItem`×2 (components/ui/select.tsx), `Dialog` (components/ui/dialog.tsx), `DialogTrigger` (components/ui/dialog.tsx), `DialogContent` (components/ui/dialog.tsx), `DialogHeader` (components/ui/dialog.tsx), `DialogTitle` (components/ui/dialog.tsx), `DialogDescription` (components/ui/dialog.tsx), `Select` (components/ui/select.tsx), `SelectTrigger` (components/ui/select.tsx), `SelectValue` (components/ui/select.tsx), `SelectContent` (components/ui/select.tsx), `GripVertical` (lucide-react), `MoreHorizontal` (lucide-react), `Trash2` (lucide-react)

**Hooks used:** `useState`×7, `useTemplateStore` (store/taskroom/templateStore.ts), `useEffect`

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `TaskStageTemplateDialog` | component | `TaskStageTemplateDialog()` | 55 |

## Interfaces

- **Other fetch/api calls (target not statically resolvable):**
  - `PUT ${process.env.NEXT_PUBLIC_TASKROOM_URL}rooms/${currentRoom.id}` (L227)
- **Environment variables (`process.env`):** `NEXT_PUBLIC_TASKROOM_URL`
- **Browser storage / cookies:** `garage_tok` (localStorage: get), `auth-token` (cookie: get)

## Dependencies

- **Internal:**
  - `components/ui/button.tsx` — `Button`
  - `components/ui/input.tsx` — `Input`
  - `components/ui/select.tsx` — `Select`, `SelectContent`, `SelectItem`, `SelectTrigger`, `SelectValue`
  - `components/ui/dialog.tsx` — `Dialog`, `DialogContent`, `DialogDescription`, `DialogHeader`, `DialogTitle`, `DialogTrigger`
  - `store/taskroom/templateStore.ts` — `useTemplateStore`, `StageTemplate`, `Stage`
- **Packages:**
  - `react` — `useEffect`, `useState`
  - `js-cookie`
  - `axios`
  - `sonner` — `toast`
  - `lucide-react` — `Plus`, `Trash2`, `GripVertical`, `MoreHorizontal`
  - `jwt-decode` — `jwtDecode`

## Used by

- `app/taskroom/Layout.tsx`
