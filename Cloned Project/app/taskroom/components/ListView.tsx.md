# `app/taskroom/components/ListView.tsx`

> React component `ListView`.

**Kind:** Next.js app-directory module (colocated) · **Lines:** 2181

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Composition

**Renders:** `BulkButton`×9 (local), `Flag`×8 (lucide-react), `ChevronDown`×6 (lucide-react), `ChevronRight`×6 (lucide-react), `Plus`×6 (lucide-react), `ColumnHeader`×6 (local), `CustomDatePicker`×5 (app/taskroom/components/custom-date-picker.tsx), `CheckSquare`×4 (lucide-react), `Square`×4 (lucide-react), `AssigneePicker`×4 (app/taskroom/components/assignee-picker.tsx), `PriorityPicker`×4 (app/taskroom/components/priority-picker.tsx), `Tag`×4 (lucide-react), `SelectItem`×4 (components/ui/select.tsx), `Calendar`×3 (lucide-react), `MoreHorizontal`×3 (lucide-react), `Users`×3 (lucide-react), `CalendarPlus`×3 (lucide-react), `ArrowLeft`×3 (lucide-react), `StatusPicker`×2 (app/taskroom/components/status-picker.tsx), `User`×2 (lucide-react), `Label`×2 (components/ui/label.tsx), `UIButton`×2 (components/ui/button.tsx), `TabsTrigger`×2 (components/ui/tabs.tsx), `TabsContent`×2 (components/ui/tabs.tsx), `GripVertical` (lucide-react), `Pencil` (lucide-react), `Trash2` (lucide-react), `Filter` (lucide-react), `Toolbar` (local), `Dialog` (components/ui/dialog.tsx), `DialogContent` (components/ui/dialog.tsx), `DialogHeader` (components/ui/dialog.tsx), `DialogTitle` (components/ui/dialog.tsx), `Input` (components/ui/input.tsx), `Select` (components/ui/select.tsx), `SelectTrigger` (components/ui/select.tsx), `SelectValue` (components/ui/select.tsx), `SelectContent` (components/ui/select.tsx), `DialogFooter` (components/ui/dialog.tsx), `Sheet` (components/ui/sheet.tsx), … +10 more

### Props

- **`ListView`**: `tasks`, `onChangeTasks`, `onOpenTask`, `roomId`

**Hooks used:** `useState`×19, `useMemo`×4, `useRef`×3, `useEffect`×2

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `TaskStatus` | type |  | 43 |
| `TaskPriority` | type |  | 44 |
| `TaskType` | type |  | 45 |
| `ChecklistItem` | interface |  | 47 |
| `Checklist` | interface |  | 55 |
| `Task` | interface |  | 64 |
| `TaskGroup` | interface |  | 84 |
| `sortNewestFirst` | function | `sortNewestFirst(list: T[]): T[]` | 97 |
| `ListView` | component | `ListView({ tasks, onChangeTasks, onOpenTask, roomId, })` | 137 |

## Interfaces

- **Other fetch/api calls (target not statically resolvable):**
  - `POST ${process.env.NEXT_PUBLIC_TASKROOM_URL}stages` (L211)
  - `GET ${process.env.NEXT_PUBLIC_TASKROOM_URL}${type}/${task.id}` (L455)
  - `POST ${process.env.NEXT_PUBLIC_TASKROOM_URL}tasks` (L573)
  - `POST ${process.env.NEXT_PUBLIC_TASKROOM_URL}subtasks` (L633)
- **Environment variables (`process.env`):** `NEXT_PUBLIC_TASKROOM_URL`
- **Browser storage / cookies:** `garage_tok` (localStorage: get)
- **Timers / queues:** `setTimeout` at L508

## Dependencies

- **Internal:**
  - `app/taskroom/components/custom-date-picker.tsx` — `CustomDatePicker`
  - `app/taskroom/components/priority-picker.tsx` — `PriorityPicker`, `PriorityLevel`
  - `app/taskroom/components/assignee-picker.tsx` — `AssigneePicker`
  - `app/taskroom/components/status-picker.tsx` — `StatusPicker`, `StatusValue`
  - `components/ui/sheet.tsx` — `Sheet`, `SheetContent`, `SheetTitle`
  - `components/ui/tabs.tsx` — `Tabs`, `TabsContent`, `TabsList`, `TabsTrigger`
  - `components/ui/dialog.tsx` — `Dialog`, `DialogContent`, `DialogHeader`, `DialogTitle`, `DialogFooter`
  - `components/ui/label.tsx` — `Label`
  - `components/ui/input.tsx` — `Input`
  - `components/ui/button.tsx` — `Button as UIButton`
  - `components/ui/select.tsx` — `Select`, `SelectContent`, `SelectItem`, `SelectTrigger`, `SelectValue`
- **Packages:**
  - `react` — `useMemo`, `useEffect`, `useRef`, `useState`
  - `axios`
  - `sonner` — `toast`
  - `lucide-react` — `Plus`, `MoreHorizontal`, `Filter`, `GripVertical`, `CheckSquare`, `Square`, …

## Used by

- `app/taskroom/[workspace]/dashboard/[space]/page.tsx`
- `app/taskroom/components/TaskDetail.tsx`
- `app/taskroom/components/TaskDetailSections.tsx`

## Notes

- Large file (2181 lines) — read it by section; line numbers above point into it.
