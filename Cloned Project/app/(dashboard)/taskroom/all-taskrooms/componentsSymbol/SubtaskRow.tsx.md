# `app/(dashboard)/taskroom/all-taskrooms/componentsSymbol/SubtaskRow.tsx`

> React component `SubtasksPanel`.

**Kind:** Next.js app-directory module (colocated) · **Lines:** 704

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Composition

**Renders:** `Button`×6 (components/ui/button.tsx), `Loader2`×4 (lucide-react), `Input`×3 (components/ui/input.tsx), `Tooltip`×2 (components/ui/tooltip.tsx), `TooltipTrigger`×2 (components/ui/tooltip.tsx), `TooltipContent`×2 (components/ui/tooltip.tsx), `SubtaskAssigneeDropdown`×2 (local), `DropdownMenu` (components/ui/dropdown-menu.tsx), `DropdownMenuTrigger` (components/ui/dropdown-menu.tsx), `TooltipProvider` (components/ui/tooltip.tsx), `ChevronsUpDown` (lucide-react), `DropdownMenuContent` (components/ui/dropdown-menu.tsx), `DropdownMenuCheckboxItem` (components/ui/dropdown-menu.tsx), `Dialog` (components/ui/dialog.tsx), `DialogContent` (components/ui/dialog.tsx), `DialogHeader` (components/ui/dialog.tsx), `DialogTitle` (components/ui/dialog.tsx), `DialogDescription` (components/ui/dialog.tsx), `Plus` (lucide-react), `Check` (lucide-react), `Edit` (lucide-react), `EditSubtaskDialog` (local)

### Props

- **`SubtasksPanel`**: `taskId: string`, `roomId: string`, `userId: string`, `stageId: string`, `employees: Employee[]`, `open: boolean`

**Hooks used:** `useState`×17, `useRef`×3, `useEffect`×2, `useCallback`×2

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `SubtasksPanel` | component | `SubtasksPanel({ taskId, roomId, userId, stageId, employees, open }: { tas…)` | 273 |

## Interfaces

- **External HTTP calls:**
  - `POST uatapi.garage.app/v1/sub_tasks` (L443)
  - `PUT uatapi.garage.app/v1/sub_tasks/${subtask._id}` (L474)
  - `PUT uatapi.garage.app/v1/sub_tasks/${id}` (L501)
  - `DELETE uatapi.garage.app/v1/sub_tasks/${id}` (L526)
- **Browser storage / cookies:** `garage_tok` (localStorage: get)
- **External hosts mentioned in the code:** `uatapi.garage.app`

## Dependencies

- **Internal:**
  - `components/ui/button.tsx` — `Button`
  - `components/ui/input.tsx` — `Input`
  - `components/ui/dialog.tsx` — `Dialog`, `DialogContent`, `DialogDescription`, `DialogHeader`, `DialogTitle`
  - `components/ui/dropdown-menu.tsx` — `DropdownMenu`, `DropdownMenuTrigger`, `DropdownMenuContent`, `DropdownMenuCheckboxItem`
  - `components/ui/tooltip.tsx` — `Tooltip`, `TooltipContent`, `TooltipProvider`, `TooltipTrigger`
  - `lib/utils.ts` — `cn`
- **Packages:**
  - `react` — `useState`, `useEffect`, `useCallback`, `useRef`
  - `lucide-react` — `Loader2`, `Plus`, `Trash2`, `Edit`, `Check`, `X`, …
  - `sonner` — `toast`
  - `js-cookie`

## Used by

No other file imports this one and it has no automatic entry point — it appears unused (or is loaded dynamically by a path the import graph cannot see).
