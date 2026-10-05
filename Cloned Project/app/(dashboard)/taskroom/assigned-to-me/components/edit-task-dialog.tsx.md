# `app/(dashboard)/taskroom/assigned-to-me/components/edit-task-dialog.tsx`

> React component `EditTaskRoom`.

**Kind:** Next.js app-directory module (colocated) · **Lines:** 2221 · **Directive:** `"use client"`

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Composition

**Renders:** `Button`×16 (components/ui/button.tsx), `Label`×9 (components/ui/label.tsx), `Loader2`×8 (lucide-react), `Input`×7 (components/ui/input.tsx), `Dialog`×4 (components/ui/dialog.tsx), `DialogContent`×4 (components/ui/dialog.tsx), `DialogTitle`×4 (components/ui/dialog.tsx), `DialogHeader`×3 (components/ui/dialog.tsx), `AttachmentSkeleton`×3 (local), `Tooltip`×2 (components/ui/tooltip.tsx), `TooltipTrigger`×2 (components/ui/tooltip.tsx), `TooltipContent`×2 (components/ui/tooltip.tsx), `Check`×2 (lucide-react), `DialogDescription`×2 (components/ui/dialog.tsx), `SubtaskAssigneeDropdown`×2 (local), `Play`×2 (lucide-react), `Search`×2 (lucide-react), `Select`×2 (components/ui/select.tsx), `SelectTrigger`×2 (components/ui/select.tsx), `SelectValue`×2 (components/ui/select.tsx), `SelectContent`×2 (components/ui/select.tsx), `SelectItem`×2 (components/ui/select.tsx), `Popover`×2 (components/ui/popover.tsx), `PopoverTrigger`×2 (components/ui/popover.tsx), `CalendarIcon`×2 (lucide-react), `PopoverContent`×2 (components/ui/popover.tsx), `Calendar`×2 (components/ui/calendar.tsx), `Plus`×2 (lucide-react), `Download`×2 (lucide-react), `TooltipProvider` (components/ui/tooltip.tsx), `ChevronsUpDown` (lucide-react), `Edit` (lucide-react), `EditSubtaskDialog` (local), `FileImage` (lucide-react), `FileText` (lucide-react), `ArrowLeft` (lucide-react), `Textarea` (components/ui/textarea.tsx), `ChevronDown` (lucide-react), `Badge` (components/ui/badge.tsx), `X` (lucide-react), … +9 more

### Props

- **`EditTaskRoom`**: `open: boolean`, `onOpenChange: (open: boolean) => void`, `task?: Task | null`, `employees: Employee[]`, `columns: Task[]`, `setColumns: Dispatch<SetStateAction<Task[]>>`, `roomId: string | undefined`, `onCancel: () => void`, `userId: string`, `workspaceUserId: string | undefined`, `userRole: string`, `conversationId: string | undefined`, `subtasks: Subtask[]`, `stagesByRoom: Column[]`, `setSubtasks: React.Dispatch<React.SetStateAction<Subtask[]>>`

**Hooks used:** `useState`×19, `useEffect`×8, `useCallback`×3

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `EditTaskRoom` | component | `EditTaskRoom({ task, employees, columns, roomId, userId, onCancel, onOpe…)` | 953 |

## Interfaces

- **Backend endpoints called (via `/backend`):**
  - `GET /backend/auth/me` (L1411)
- **External HTTP calls:**
  - `POST uatapi.garage.app/v1/sub_tasks` (L629)
  - `PUT uatapi.garage.app/v1/sub_tasks/${subtask._id}` (L660)
  - `PUT uatapi.garage.app/v1/sub_tasks/${id}` (L716)
  - `DELETE uatapi.garage.app/v1/sub_tasks/${id}` (L741)
  - `GET https://uatapi.garage.app/api/s3upload/download-url?url=${url}` (L1193)
  - `POST uatapi.garage.app/api/s3upload/multiple` (L1267)
  - `PUT uatapi.garage.app/v1/tasks/${task._id}` (L1479)
  - `POST uatapi.garage.app/api/chat/conversations/${conversationId}/participants` (L1554)
  - `POST uatapi.garage.app/v1/files/bulk` (L1582)
- **Environment variables (`process.env`):** `NEXT_PUBLIC_API_URL`
- **Browser storage / cookies:** `garage_tok` (localStorage: get)
- **External hosts mentioned in the code:** `uatapi.garage.app`, `docs.google.com`

## Dependencies

- **Internal:**
  - `lib/utils.ts` — `cn`
  - `components/ui/popover.tsx` — `Popover`, `PopoverContent`, `PopoverTrigger`
  - `components/ui/button.tsx` — `Button`
  - `components/ui/input.tsx` — `Input`
  - `components/ui/label.tsx` — `Label`
  - `components/ui/textarea.tsx` — `Textarea`
  - `components/ui/select.tsx` — `Select`, `SelectContent`, `SelectItem`, `SelectTrigger`, `SelectValue`
  - `components/ui/badge.tsx` — `Badge`
  - `components/ui/calendar.tsx` — `Calendar`
  - `components/ui/dialog.tsx` — `Dialog`, `DialogContent`, `DialogDescription`, `DialogHeader`, `DialogTitle`
  - `components/ui/dropdown-menu.tsx` — `DropdownMenu`, `DropdownMenuTrigger`, `DropdownMenuContent`, `DropdownMenuCheckboxItem`
  - `app/(dashboard)/taskroom/assigned-to-me/types/kanban.ts` — `Column`, `Task`, `Subtask`, `(types only)`
  - `app/(dashboard)/taskroom/assigned-to-me/components/comments-panel.tsx` — `CommentsPanel`
  - `components/ui/tabs.tsx` — `Tabs`, `TabsContent`, `TabsList`, `TabsTrigger`
  - `components/ui/tooltip.tsx` — `Tooltip`, `TooltipContent`, `TooltipProvider`, `TooltipTrigger`
- **Packages:**
  - `react` — `useEffect`, `SetStateAction`, `Dispatch`, `useCallback`, `useState`
  - `sonner` — `toast`
  - `date-fns` — `format`, `formatDistanceToNow`
  - `lucide-react` — `CalendarDays`, `Clock`, `User`, `Check`, `ChevronsUpDown`, `X`, …
  - `js-cookie`

## Used by

- `app/(dashboard)/taskroom/assigned-to-me/page.tsx`

## Notes

- Large file (2221 lines) — read it by section; line numbers above point into it.
