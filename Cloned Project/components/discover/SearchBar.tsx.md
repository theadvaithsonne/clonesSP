# `components/discover/SearchBar.tsx`

> React component `SearchBar`.

**Kind:** React component · **Lines:** 76 · **Directive:** `"use client"`

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Composition

**Renders:** `Search` (lucide-react), `Input` (components/ui/input.tsx), `X` (lucide-react)

### Props

- **`SearchBar`**: `value: string`, `onChange: (value: string) => void`, `placeholder?: string`, `onSearch?: () => void`, `debounceMs?: number`

**Hooks used:** `useEffect`×2, `useCallback`×2, `useState`

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `SearchBar` | component | `SearchBar({ value, onChange, placeholder = "Search HQs...", onSearch,…)` | 15 |

## Interfaces

- **Timers / queues:** `setTimeout` at L31

## Dependencies

- **Internal:**
  - `components/ui/input.tsx` — `Input`
- **Packages:**
  - `react` — `useState`, `useEffect`, `useCallback`
  - `lucide-react` — `Search`, `X`

## Used by

- `components/discover/index.ts`
