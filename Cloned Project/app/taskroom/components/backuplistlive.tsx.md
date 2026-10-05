# `app/taskroom/components/backuplistlive.tsx`

> React component `ListView`.

**Kind:** Next.js app-directory module (colocated) · **Lines:** 1975

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Composition

**Renders:** `BulkButton`×9 (local), `Flag`×8 (lucide-react), `ChevronDown`×6 (lucide-react), `ChevronRight`×6 (lucide-react), `ColumnHeader`×6 (local), `Plus`×5 (lucide-react), `Tag`×5 (lucide-react), `CheckSquare`×4 (lucide-react), `Square`×4 (lucide-react), `CustomDatePicker`×3 (app/taskroom/components/custom-date-picker.tsx), `Calendar`×3 (lucide-react), `MoreHorizontal`×3 (lucide-react), `Package`×3 (lucide-react), `Sparkles`×3 (lucide-react), `Users`×3 (lucide-react), `CalendarPlus`×3 (lucide-react), `FileText`×3 (lucide-react), `HelpCircle`×3 (lucide-react), `ArrowLeft`×3 (lucide-react), `StatusPicker`×2 (app/taskroom/components/status-picker.tsx), `AssigneePicker`×2 (app/taskroom/components/assignee-picker.tsx), `User`×2 (lucide-react), `PriorityPicker`×2 (app/taskroom/components/priority-picker.tsx), `TabsTrigger`×2 (components/ui/tabs.tsx), `TabsContent`×2 (components/ui/tabs.tsx), `GripVertical` (lucide-react), `Pencil` (lucide-react), `Trash2` (lucide-react), `ArrowUpDown` (lucide-react), `Filter` (lucide-react), `Toolbar` (local), `Sheet` (components/ui/sheet.tsx), `SheetContent` (components/ui/sheet.tsx), `SheetTitle` (components/ui/sheet.tsx), `Tabs` (components/ui/tabs.tsx), `TabsList` (components/ui/tabs.tsx), `Hash` (lucide-react), `Type` (lucide-react), `CalendarDays` (lucide-react), `ChevronLeft` (lucide-react), … +2 more

### Props

- **`ListView`**: `tasks`, `onChangeTasks`, `onOpenTask`

**Hooks used:** `useState`×18, `useMemo`×6, `useRef`×2, `useEffect`×2

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `TaskStatus` | type |  | 37 |
| `TaskPriority` | type |  | 38 |
| `TaskType` | type |  | 39 |
| `ChecklistItem` | interface |  | 41 |
| `Checklist` | interface |  | 49 |
| `Task` | interface |  | 58 |
| `TaskGroup` | interface |  | 76 |
| `ListView` | component | `ListView({ tasks, onChangeTasks, onOpenTask, })` | 105 |

## Interfaces

- **Timers / queues:** `setTimeout` at L427

## Dependencies

- **Internal:**
  - `app/taskroom/components/custom-date-picker.tsx` — `CustomDatePicker`
  - `app/taskroom/components/priority-picker.tsx` — `PriorityPicker`, `PriorityLevel`
  - `app/taskroom/components/assignee-picker.tsx` — `AssigneePicker`
  - `app/taskroom/components/status-picker.tsx` — `StatusPicker`, `StatusValue`
  - `components/ui/sheet.tsx` — `Sheet`, `SheetContent`, `SheetTitle`
  - `components/ui/tabs.tsx` — `Tabs`, `TabsContent`, `TabsList`, `TabsTrigger`
- **Packages:**
  - `react` — `useMemo`, `useEffect`, `useRef`, `useState`
  - `lucide-react` — `Plus`, `MoreHorizontal`, `Filter`, `ArrowUpDown`, `GripVertical`, `CheckSquare`, …

## Used by

No other file imports this one and it has no automatic entry point — it appears unused (or is loaded dynamically by a path the import graph cannot see).

## Notes

- Large file (1975 lines) — read it by section; line numbers above point into it.
