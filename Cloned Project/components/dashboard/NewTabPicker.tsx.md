# `components/dashboard/NewTabPicker.tsx`

> React component `NewTabPicker`.

**Kind:** React component · **Lines:** 299 · **Directive:** `"use client"`

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Composition

**Renders:** `Search` (lucide-react)

### Props

- **`NewTabPicker`**: `tabSet?: TabSet`, `isOpen: boolean`, `onClose: () => void`, `onSelect: (tabName: string) => void`, `triggerRect: DOMRect | null`

**Hooks used:** `useEffect`×4, `useState`×2, `useRef`×2, `useAmIFounder` (lib/hooks/useAmIFounder.ts), `useModuleAccess` (lib/hooks/useModuleAccess.ts), `useMemo`

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `default (NewTabPicker)` | component | `NewTabPicker({ tabSet = "main", isOpen, onClose, onSelect, triggerRect, …)` | 77 |

## Interfaces

None detected: no endpoints, events, data access or environment reads were found.

## Dependencies

- **Internal:**
  - `lib/utils.ts` — `cn`
  - `lib/hooks/useAmIFounder.ts` — `useAmIFounder`
  - `lib/hooks/useModuleAccess.ts` — `useModuleAccess`
  - `lib/founderPages.ts` — `TabSet`, `(types only)`
- **Packages:**
  - `react` — `useState`, `useEffect`, `useRef`, `useMemo`
  - `react-dom` — `createPortal`
  - `lucide-react` — `Search`

## Used by

- `components/dashboard/AppTabBar.tsx`
