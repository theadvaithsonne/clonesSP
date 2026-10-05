# `app/taskroom/components/assignee-picker.tsx`

> React component `AssigneePicker`.

**Kind:** Next.js app-directory module (colocated) · **Lines:** 144 · **Directive:** `"use client"`

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Composition

**Renders:** `Popover` (components/ui/popover.tsx), `PopoverTrigger` (components/ui/popover.tsx), `PopoverContent` (components/ui/popover.tsx), `Search` (lucide-react), `X` (lucide-react), `RefreshCw` (lucide-react), `UserPlus` (lucide-react)

### Props

- **`AssigneePicker`**: `assignee?: string`, `onSelect: (assignee: string | undefined) => void`, `children: React.ReactNode`

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `User` | interface |  | 12 |
| `AssigneePicker` | component | `AssigneePicker({ assignee, onSelect, children }: AssigneePickerProps)` | 34 |

## Interfaces

None detected: no endpoints, events, data access or environment reads were found.

## Dependencies

- **Internal:**
  - `lib/utils.ts` — `cn`
  - `components/ui/popover.tsx` — `Popover`, `PopoverContent`, `PopoverTrigger`
- **Packages:**
  - `react`
  - `lucide-react` — `Search`, `UserPlus`, `X`, `RefreshCw`

## Used by

- `app/taskroom/components/ListView.tsx`
- `app/taskroom/components/TaskDetailSections.tsx`
- `app/taskroom/components/backuplistlive.tsx`
