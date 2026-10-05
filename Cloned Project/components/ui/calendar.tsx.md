# `components/ui/calendar.tsx`

> React component `Calendar`.

**Kind:** UI primitive (shadcn/Radix wrapper) · **Lines:** 70 · **Directive:** `"use client"`

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Composition

**Renders:** `DayPicker` (react-day-picker), `Icon` (local)

### Props

- **`Calendar`**: `props: CalendarProps`

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `CalendarProps` | type |  | 10 |
| `Calendar` | component | `Calendar({ className, classNames, showOutsideDays = true, ...props }…)` | 69 |

## Interfaces

None detected: no endpoints, events, data access or environment reads were found.

## Dependencies

- **Internal:**
  - `lib/utils.ts` — `cn`
  - `components/ui/button.tsx` — `buttonVariants`
- **Packages:**
  - `react`
  - `lucide-react` — `ChevronLeft`, `ChevronRight`
  - `react-day-picker` — `DayPicker`

## Used by

- `app/(dashboard)/deals/leads/[id]/page.tsx`
- `app/(dashboard)/deals/leads/page.tsx`
- `app/(dashboard)/taskroom/all-taskrooms/componentsSymbol/create-task-dialog.tsx`
- `app/(dashboard)/taskroom/all-taskrooms/componentsSymbol/edit-task-dialog.tsx`
- `app/(dashboard)/taskroom/assigned-to-me/components/edit-task-dialog.tsx`
- `app/(dashboard)/thoughts/components/blocks/DatePickerBlock.tsx`
- `app/(dashboard)/thoughts/components/blocks/ReminderBlock.tsx`
- `app/taskroom/components/custom-date-picker.tsx`
- `app/taskroom/components/date-range-picker.tsx`
- `components/athena/components/custom-date-picker.tsx`
- `components/athena/components/date-range-picker.tsx`
- `components/chat/SlashCommandForm.tsx`
- `components/dashboard/CashbackCodeSheet.tsx`
- `components/dashboard/CoworkingSpacesPage.tsx`
- `components/dashboard/RightPanel.tsx`
