# `app/taskroom/components/TaskDetailSections.tsx`

> React components `TaskSubtasks`, `TaskChecklists`.

**Kind:** Next.js app-directory module (colocated) · **Lines:** 350

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Composition

**Renders:** `Plus`×4 (lucide-react), `SubtaskRow`×2 (local), `UserPlus`×2 (lucide-react), `ArrowUpDown` (lucide-react), `Maximize2` (lucide-react), `Sparkles` (lucide-react), `ChevronDown` (lucide-react), `ChevronRight` (lucide-react), `Link2` (lucide-react), `UserIcon` (lucide-react), `Flag` (lucide-react), `Calendar` (lucide-react), `MoreHorizontal` (lucide-react), `ChecklistGroup` (local), `Check` (lucide-react), `Trash2` (lucide-react), `AssigneePicker` (app/taskroom/components/assignee-picker.tsx)

### Props

- **`TaskSubtasks`**: `subtasks`, `onAddSubtask`
- **`TaskChecklists`**: `checklists`, `onAddChecklist`, `onAddItem`, `onToggleItem`, `onDeleteItem`

**Hooks used:** `useState`×5

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `TaskSubtasks` | component | `TaskSubtasks({ subtasks, onAddSubtask })` | 18 |
| `TaskChecklists` | component | `TaskChecklists({ checklists, onAddChecklist, onAddItem, onToggleItem, onDe…)` | 168 |

## Interfaces

None detected: no endpoints, events, data access or environment reads were found.

## Dependencies

- **Internal:**
  - `app/taskroom/components/ListView.tsx` — `Task`, `Checklist`, `ChecklistItem`, `TaskPriority`
  - `lib/utils.ts` — `cn`
  - `app/taskroom/components/assignee-picker.tsx` — `AssigneePicker`
- **Packages:**
  - `react` — `useState`
  - `lucide-react` — `ChevronRight`, `ChevronDown`, `MoreHorizontal`, `Plus`, `User as UserIcon`, `Calendar`, …

## Used by

No other file imports this one and it has no automatic entry point — it appears unused (or is loaded dynamically by a path the import graph cannot see).
