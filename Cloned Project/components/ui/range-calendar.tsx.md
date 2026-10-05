# `components/ui/range-calendar.tsx`

> Two-month range calendar on plain "YYYY-MM-DD" strings.

**Kind:** UI primitive (shadcn/Radix wrapper) · **Lines:** 265 · **Directive:** `"use client"`

<!-- docgen:auto -->

## Purpose
Two-month range calendar on plain "YYYY-MM-DD" strings.

Lifted out of components/analytics/ControlBar.tsx so other admin surfaces
(Daily Reports) get the same picker instead of a native <input type="date">.
Values stay strings on purpose: they survive drawer draft state and compare
with `<`/`>` without any timezone drift; the caller decides what "today"
means via `maxIso`.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Composition

**Renders:** `MonthGrid`×2 (local), `ChevronLeft` (lucide-react), `ChevronRight` (lucide-react)

### Props

- **`RangeCalendar`**: `start: string`, `end: string`, `onChange: (next: { start: string; end: string }) => void`, `maxIso?: string`

**Hooks used:** `useState`×4, `useEffect`×2

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `ymd` | function | `ymd(y: number, m: number, d: number): string` — "YYYY-MM-DD" for a y/m/d triple, zero-padded. | 26 |
| `todayIso` | function | `todayIso(): string` — Today as YYYY-MM-DD, UTC — the analytics clock is UTC, so "today" must be too. | 31 |
| `isValidIso` | function | `isValidIso(v: string): boolean` — Accepts a typed date only once it is a real calendar date, so half-typed input never wipes the selection mid-keystroke. | 134 |
| `RangeCalendar` | component | `RangeCalendar({ start, end, onChange, maxIso: maxIsoProp, }: { start: str…)` | 140 |

## Interfaces

None detected: no endpoints, events, data access or environment reads were found.

## Dependencies

- **Internal:** none
- **Packages:**
  - `react` — `useEffect`, `useState`
  - `lucide-react` — `ChevronLeft`, `ChevronRight`

## Used by

- `components/analytics/ControlBar.tsx`
- `components/garage-admin/DailyReportsFilterDrawer.tsx`
