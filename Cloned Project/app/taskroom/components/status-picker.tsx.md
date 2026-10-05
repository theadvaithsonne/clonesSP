# `app/taskroom/components/status-picker.tsx`

> React component `StatusPicker`.

**Kind:** Next.js app-directory module (colocated) · **Lines:** 127 · **Directive:** `"use client"`

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Composition

**Renders:** `Popover` (components/ui/popover.tsx), `PopoverTrigger` (components/ui/popover.tsx), `PopoverContent` (components/ui/popover.tsx), `Square` (lucide-react), `Check` (lucide-react)

### Props

- **`StatusPicker`**: `status?: string`, `onSelect: (status: StatusValue) => void`, `children: React.ReactNode`, `initialTasks?: any[]`

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `StatusValue` | type |  | 12 |
| `StatusPicker` | component | `StatusPicker({ status, onSelect, children, initialTasks }: StatusPickerP…)` | 21 |

## Interfaces

None detected: no endpoints, events, data access or environment reads were found.

## Dependencies

- **Internal:**
  - `lib/utils.ts` — `cn`
  - `components/ui/popover.tsx` — `Popover`, `PopoverContent`, `PopoverTrigger`
- **Packages:**
  - `react`
  - `lucide-react` — `Search`, `Square`, `PlayCircle`, `FlaskConical`, `CheckCircle2`, `MoreHorizontal`, …

## Used by

- `app/taskroom/components/ListView.tsx`
- `app/taskroom/components/backuplistlive.tsx`
