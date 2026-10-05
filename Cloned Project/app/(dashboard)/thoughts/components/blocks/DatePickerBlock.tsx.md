# `app/(dashboard)/thoughts/components/blocks/DatePickerBlock.tsx`

> Module exporting `datePickerBlock`.

**Kind:** Next.js app-directory module (colocated) · **Lines:** 200 · **Directive:** `"use client"`

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Composition

**Renders:** `Popover` (components/ui/popover.tsx), `PopoverTrigger` (components/ui/popover.tsx), `CalendarIcon` (lucide-react), `PopoverContent` (components/ui/popover.tsx), `CalendarUI` (components/ui/calendar.tsx), `DatePickerRenderer` (local)

**Hooks used:** `useState`×2, `useMemo`×2

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `datePickerBlock` | const | `= createReactBlockSpec( { type: "datePicker" as const, propSchema: { date: { default: "", type: "st…` | 186 |

## Interfaces

None detected: no endpoints, events, data access or environment reads were found.

## Dependencies

- **Internal:**
  - `components/ui/popover.tsx` — `Popover`, `PopoverContent`, `PopoverTrigger`
  - `components/ui/calendar.tsx` — `Calendar as CalendarUI`
- **Packages:**
  - `react` — `useMemo`, `useState`
  - `lucide-react` — `Calendar as CalendarIcon`
  - `@blocknote/react` — `createReactBlockSpec`

## Used by

- `app/(dashboard)/thoughts/components/blocks/index.ts`
