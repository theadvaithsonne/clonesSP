# `components/dashboard/TimeSelector.tsx`

> React component `TimeSelector`.

**Kind:** React component · **Lines:** 280

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Composition

**Renders:** `Clock` (lucide-react)

### Props

- **`TimeSelector`**: `value: string`, `onChange: (value: string) => void`, `relativeTo?: string`, `className?: string`

**Hooks used:** `useEffect`×5, `useState`×3, `useRef`×2, `useMemo`

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `TimeSelector` | component | `TimeSelector({ value, onChange, relativeTo, className }: TimeSelectorPro…)` | 98 |

## Interfaces

None detected: no endpoints, events, data access or environment reads were found.

## Dependencies

- **Internal:**
  - `lib/utils.ts` — `cn`
- **Packages:**
  - `react` — `useState`, `useEffect`, `useRef`, `useMemo`
  - `lucide-react` — `Clock`

## Used by

- `components/dashboard/WorkshopsPage.tsx`
- `components/dashboard/liveStreams/EditSessionSheet.tsx`
- `components/dashboard/liveStreams/SessionScheduleEditor.tsx`
