# `components/ui/searchable-select.tsx`

> React components `SearchableSelect`, `SearchableSelectField`.

**Kind:** UI primitive (shadcn/Radix wrapper) · **Lines:** 285 · **Directive:** `"use client"`

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Composition

**Renders:** `SearchableSelect`×2 (local), `Search` (lucide-react), `ChevronsUpDown` (lucide-react), `Sheet` (components/ui/sheet.tsx), `SheetContent` (components/ui/sheet.tsx), `SheetHeader` (components/ui/sheet.tsx), `SheetTitle` (components/ui/sheet.tsx), `Popover` (components/ui/popover.tsx), `PopoverTrigger` (components/ui/popover.tsx), `PopoverContent` (components/ui/popover.tsx)

### Props

- **`SearchableSelect`**: `options: SearchableOption[]`, `value?: string`, `onSelect: (value: string) => void`, `placeholder?: string`, `emptyText?: string`, `limit?: number`, `autoFocus?: boolean`, `className?: string`, `fill?: boolean`
- **`SearchableSelectField`**: `options: SearchableOption[]`, `value?: string`, `onChange: (value: string) => void`, `placeholder?: string`, `searchPlaceholder?: string`, `emptyText?: string`, `disabled?: boolean`, `className?: string`, `contentClassName?: string`, `align?: "start" | "center" | "end"`, `limit?: number`, `renderValue?: (option: SearchableOption | undefined) => ReactNode`, `openIn?: "popover" | "panel"`, `panelTitle?: string`

**Hooks used:** `useState`×2, `useMemo`×2

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `SearchableOption` | interface |  | 14 |
| `SearchableSelect` | component | `SearchableSelect({ options, value, onSelect, placeholder = "Search...", empt…)` — THE dropdown template — one searchable select for every dropdown field. | 50 |
| `SearchableSelectField` | component | `SearchableSelectField({ options, value, onChange, placeholder = "Select…", search…)` — Inline form-field version of the dropdown template: a trigger button (shows the selected option) that opens a Popover containing the `SearchableSelect` search + rows. | 166 |

## Interfaces

None detected: no endpoints, events, data access or environment reads were found.

## Dependencies

- **Internal:**
  - `components/ui/popover.tsx` — `Popover`, `PopoverContent`, `PopoverTrigger`
  - `components/ui/sheet.tsx` — `Sheet`, `SheetContent`, `SheetHeader`, `SheetTitle`
  - `lib/utils.ts` — `cn`
- **Packages:**
  - `react` — `useMemo`, `useState`, `ReactNode`
  - `lucide-react` — `ChevronsUpDown`, `Search`

## Used by

- `app/garage-admin/(admin-dashboard)/user-wallets/page.tsx`
- `components/dashboard/jobs/founder/wizard/StepBasics.tsx`
- `components/garage-admin/catchup/IgniteCallScheduleDrawer.tsx`
