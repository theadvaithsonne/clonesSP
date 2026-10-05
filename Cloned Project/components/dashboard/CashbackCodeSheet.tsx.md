# `components/dashboard/CashbackCodeSheet.tsx`

> React component `CashbackCodeSheet`.

**Kind:** React component · **Lines:** 905 · **Directive:** `"use client"`

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Composition

**Renders:** `FieldLabel`×13 (local), `TicketPercent`×2 (lucide-react), `X`×2 (lucide-react), `Select`×2 (components/ui/select.tsx), `SelectTrigger`×2 (components/ui/select.tsx), `SelectValue`×2 (components/ui/select.tsx), `SelectContent`×2 (components/ui/select.tsx), `SelectItem`×2 (components/ui/select.tsx), `DatePickerField`×2 (local), `Sheet` (components/ui/sheet.tsx), `SheetContent` (components/ui/sheet.tsx), `SheetTitle` (components/ui/sheet.tsx), `SheetDescription` (components/ui/sheet.tsx), `Sparkles` (lucide-react), `DistributionsView` (local), `Textarea` (components/ui/textarea.tsx), `CashbackCodeItemPicker` (components/dashboard/CashbackCodeItemPicker.tsx), `Slider` (components/ui/slider.tsx), `CashbackBuyerPicker` (components/dashboard/CashbackBuyerPicker.tsx), `ChevronDown` (lucide-react), `AlertCircle` (lucide-react), `Loader2` (lucide-react), `Popover` (components/ui/popover.tsx), `PopoverTrigger` (components/ui/popover.tsx), `CalendarDays` (lucide-react), `PopoverContent` (components/ui/popover.tsx), `Calendar` (components/ui/calendar.tsx), `CheckCircle2` (lucide-react), `XCircle` (lucide-react), `Clock` (lucide-react), `StatusPill` (local)

### Props

- **`CashbackCodeSheet`**: `open: boolean`, `mode: SheetMode`, `onOpenChange: (open: boolean) => void`, `orgId: string | null`, `existing?: CashbackCode | null`, `onSaved?: (code: CashbackCode) => void`

**Hooks used:** `useState`×20, `useEffect`×2, `useMemo`

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `CashbackCodeSheet` | component | `CashbackCodeSheet({ open, mode, onOpenChange, orgId, existing, onSaved, }: Pr…)` | 125 |

## Interfaces

None detected: no endpoints, events, data access or environment reads were found.

## Dependencies

- **Internal:**
  - `components/ui/sheet.tsx` — `Sheet`, `SheetContent`, `SheetHeader`, `SheetTitle`, `SheetDescription`
  - `components/ui/select.tsx` — `Select`, `SelectContent`, `SelectItem`, `SelectTrigger`, `SelectValue`
  - `components/ui/slider.tsx` — `Slider`
  - `components/ui/textarea.tsx` — `Textarea`
  - `components/ui/calendar.tsx` — `Calendar`
  - `components/ui/popover.tsx` — `Popover`, `PopoverContent`, `PopoverTrigger`
  - `lib/utils.ts` — `cn`
  - `components/dashboard/CashbackCodeItemPicker.tsx` — `CashbackCodeItemPicker`
  - `components/dashboard/CashbackBuyerPicker.tsx` — `CashbackBuyerPicker`
  - `lib/hooks/useCashbackCodes.ts` — `createCashbackCode`, `updateCashbackCode`, `fetchDistributionsForCode`, `CashbackCode`, `CashbackDistribution`, `CashbackProductType`, `EligibleBuyer`, `EligibleItem`
- **Packages:**
  - `react` — `useEffect`, `useMemo`, `useState`
  - `lucide-react` — `CalendarDays`, `ChevronDown`, `Loader2`, `TicketPercent`, `X`, `AlertCircle`, …
  - `sonner` — `toast`

## Used by

- `components/dashboard/CashbackCodesTab.tsx`
