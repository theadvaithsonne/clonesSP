# `components/dashboard/CashbackBuyerPicker.tsx`

> React component `CashbackBuyerPicker`.

**Kind:** React component · **Lines:** 213 · **Directive:** `"use client"`

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Composition

**Renders:** `X`×2 (lucide-react), `Users` (lucide-react), `ChevronDown` (lucide-react), `Search` (lucide-react), `Loader2` (lucide-react)

### Props

- **`CashbackBuyerPicker`**: `selected: EligibleBuyer[]`, `onChange: (buyers: EligibleBuyer[]) => void`, `disabled?: boolean`

**Hooks used:** `useState`×5, `useRef`×2, `useEffect`×2, `useMemo`

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `CashbackBuyerPicker` | component | `CashbackBuyerPicker({ selected, onChange, disabled }: Props)` | 28 |

## Interfaces

None detected: no endpoints, events, data access or environment reads were found.

## Dependencies

- **Internal:**
  - `lib/utils.ts` — `cn`
  - `lib/hooks/useCashbackCodes.ts` — `fetchEligibleBuyers`, `EligibleBuyer`
- **Packages:**
  - `react` — `useEffect`, `useMemo`, `useRef`, `useState`
  - `lucide-react` — `ChevronDown`, `Loader2`, `Search`, `X`, `Users`

## Used by

- `components/dashboard/CashbackCodeSheet.tsx`
