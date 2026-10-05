# `app/taskroom/components/custom-date-picker.tsx`

> React component `CustomDatePicker`.

**Kind:** Next.js app-directory module (colocated) · **Lines:** 232 · **Directive:** `"use client"`

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Composition

**Renders:** `CalendarIcon`×2 (lucide-react), `X`×2 (lucide-react), `Popover` (components/ui/popover.tsx), `PopoverTrigger` (components/ui/popover.tsx), `PopoverContent` (components/ui/popover.tsx), `ChevronRight` (lucide-react), `Calendar` (components/ui/calendar.tsx)

### Props

- **`CustomDatePicker`**: `startDate?: Date`, `dueDate?: Date`, `onSelect: (dates: { start?: Date; due?: Date }) => void`, `children: React.ReactNode`, `defaultTab?: "start" | "due"`

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `CustomDatePicker` | component | `CustomDatePicker({ startDate, dueDate, onSelect, children, defaultTab = "due…)` | 24 |

## Interfaces

None detected: no endpoints, events, data access or environment reads were found.

## Dependencies

- **Internal:**
  - `lib/utils.ts` — `cn`
  - `components/ui/button.tsx` — `Button`
  - `components/ui/calendar.tsx` — `Calendar`
  - `components/ui/popover.tsx` — `Popover`, `PopoverContent`, `PopoverTrigger`
- **Packages:**
  - `react`
  - `date-fns` — `format`, `addDays`, `nextMonday`, `nextSaturday`, `addWeeks`, `startOfDay`, …
  - `lucide-react` — `Calendar as CalendarIcon`, `Clock`, `X`, `ChevronRight`

## Used by

- `app/taskroom/components/ListView.tsx`
- `app/taskroom/components/backuplistlive.tsx`
