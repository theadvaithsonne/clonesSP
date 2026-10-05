# `components/dashboard/inlineApps/events/DateTimeField.tsx`

> A themed replacement for `<input type="datetime-local">`.

**Kind:** React component · **Lines:** 630 · **Directive:** `"use client"`

<!-- docgen:auto -->

## Purpose
A themed replacement for `<input type="datetime-local">`.

The native control paints an OS popup — white, blue-accented, and completely
outside our styling reach — which looked like a bug sitting inside the dark
event forms. This is the same value contract (a local `YYYY-MM-DDTHH:mm`
string, so `toLocalInput` / `fromLocalInput` are unchanged) with a surface
that matches the rest of the module, plus the things the native picker
never gave us: presets, a readable summary, a `min` bound that actually
greys out impossible dates, and one-tap common times.

The panel renders through a portal because every caller lives inside a
modal with `overflow-hidden` / `overflow-y-auto`, which would clip or scroll
an inline popover away.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Composition

**Renders:** `TimeCell`×2 (local), `ChevronLeft` (lucide-react), `ChevronRight` (lucide-react), `Clock` (lucide-react), `Label` (components/dashboard/inlineApps/events/ui.tsx), `CalendarDays` (lucide-react), `X` (lucide-react)

### Props

- **`DateTimeField`**: `label?: string`, `required?: boolean`, `hint?: string`, `value: string`, `onChange: (value: string) => void`, `min?: string`, `placeholder?: string`, `disabled?: boolean`, `className?: string`, `clearable?: boolean`

**Hooks used:** `useCallback`×6, `useState`×5, `useMemo`×3, `useEffect`×3, `useRef`×2, `useLayoutEffect`×2

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `default (DateTimeField)` | component | `DateTimeField({ label, required, hint, value, onChange, min, placeholder …)` | 133 |

## Interfaces

None detected: no endpoints, events, data access or environment reads were found.

## Dependencies

- **Internal:**
  - `components/dashboard/inlineApps/events/ui.tsx` — `GOLD`, `Label`
- **Packages:**
  - `react` — `useCallback`, `useEffect`, `useLayoutEffect`, `useMemo`, `useRef`, `useState`
  - `react-dom` — `createPortal`
  - `lucide-react` — `CalendarDays`, `ChevronLeft`, `ChevronRight`, `Clock`, `X`

## Used by

- `components/dashboard/inlineApps/events/CreateEventModal.tsx`
- `components/dashboard/inlineApps/events/sections/TicketsSection.tsx`
