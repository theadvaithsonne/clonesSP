# `app/taskroom/components/priority-picker.tsx`

> React component `PriorityPicker`.

**Kind:** Next.js app-directory module (colocated) · **Lines:** 78 · **Directive:** `"use client"`

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Composition

**Renders:** `Popover` (components/ui/popover.tsx), `PopoverTrigger` (components/ui/popover.tsx), `PopoverContent` (components/ui/popover.tsx), `Ban` (lucide-react), `Flag` (lucide-react), `Sparkles` (lucide-react)

### Props

- **`PriorityPicker`**: `priority?: PriorityLevel`, `onSelect: (priority: PriorityLevel) => void`, `children: React.ReactNode`

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `PriorityLevel` | type |  | 13 |
| `PriorityPicker` | component | `PriorityPicker({ priority, onSelect, children }: PriorityPickerProps)` | 21 |

## Interfaces

None detected: no endpoints, events, data access or environment reads were found.

## Dependencies

- **Internal:**
  - `lib/utils.ts` — `cn`
  - `components/ui/popover.tsx` — `Popover`, `PopoverContent`, `PopoverTrigger`
- **Packages:**
  - `react`
  - `lucide-react` — `Flag`, `Ban`, `Sparkles`

## Used by

- `app/taskroom/components/ListView.tsx`
- `app/taskroom/components/backuplistlive.tsx`
