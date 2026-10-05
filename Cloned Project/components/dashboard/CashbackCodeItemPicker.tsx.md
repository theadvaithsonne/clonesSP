# `components/dashboard/CashbackCodeItemPicker.tsx`

> React component `CashbackCodeItemPicker`.

**Kind:** React component · **Lines:** 219 · **Directive:** `"use client"`

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Composition

**Renders:** `Package`×2 (lucide-react), `ChevronDown` (lucide-react), `Search` (lucide-react), `X` (lucide-react), `Loader2` (lucide-react)

### Props

- **`CashbackCodeItemPicker`**: `productType: CashbackProductType | ""`, `orgId: string | null`, `value: EligibleItem | null`, `onChange: (item: EligibleItem | null) => void`, `disabled?: boolean`

**Hooks used:** `useState`×5, `useEffect`×2, `useRef`, `useMemo`

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `CashbackCodeItemPicker` | component | `CashbackCodeItemPicker({ productType, orgId, value, onChange, disabled, }: Props)` | 26 |

## Interfaces

None detected: no endpoints, events, data access or environment reads were found.

## Dependencies

- **Internal:**
  - `lib/utils.ts` — `cn`
  - `lib/hooks/useCashbackCodes.ts` — `fetchEligibleItems`, `CashbackProductType`, `EligibleItem`
- **Packages:**
  - `react` — `useEffect`, `useMemo`, `useRef`, `useState`
  - `lucide-react` — `ChevronDown`, `Loader2`, `Search`, `X`, `Package`

## Used by

- `components/dashboard/CashbackCodeSheet.tsx`
