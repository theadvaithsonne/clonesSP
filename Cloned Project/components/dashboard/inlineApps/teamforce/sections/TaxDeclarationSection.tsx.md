# `components/dashboard/inlineApps/teamforce/sections/TaxDeclarationSection.tsx`

> React component `TaxDeclarationSection`.

**Kind:** React component · **Lines:** 1367 · **Directive:** `"use client"`

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Composition

**Renders:** `Field`×21 (local), `NumberInput`×15 (local), `Loader2`×8 (lucide-react), `Row`×7 (local), `FormCard`×6 (local), `TextInput`×4 (local), `Lock`×3 (lucide-react), `LockOpen`×3 (lucide-react), `InfoCard`×3 (components/dashboard/inlineApps/teamforce/lib/InfoCard.tsx), `Check`×3 (lucide-react), `Building2`×2 (lucide-react), `CheckboxRow`×2 (local), `RegimePreviewCard`×2 (local), `RefreshCw`×2 (lucide-react), `User` (lucide-react), `OrgSummaryView` (local), `Pagination` (local), `ChevronLeft` (lucide-react), `ChevronRight` (lucide-react), `Icon` (local)

**Hooks used:** `useState`×18, `useEffect`×6, `useCallback`×3, `useRef`×2, `useMemo`×2, `useAmIFounder` (lib/hooks/useAmIFounder.ts), `usePagination` (local)

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `default (TaxDeclarationSection)` | component | `TaxDeclarationSection()` | 156 |

## Interfaces

- **Timers / queues:** `setTimeout` at L1060

## Dependencies

- **Internal:**
  - `lib/hooks/useAmIFounder.ts` — `useAmIFounder`
  - `components/dashboard/inlineApps/teamforce/api.ts` — `getTaxDeclaration`, `upsertTaxDeclaration`, `lockTaxDeclaration`, `unlockTaxDeclaration`, `getRegimePreview`, `getOrgTaxSummary`
  - `components/dashboard/inlineApps/teamforce/types.ts` — `EmployeeTaxDeclaration`, `Regime`, `RegimePreview`, `OrgTaxSummaryEntry`, `(types only)`
  - `components/dashboard/inlineApps/teamforce/lib/InfoCard.tsx` — `InfoCard (default)`
- **Packages:**
  - `react` — `useState`, `useEffect`, `useCallback`, `useMemo`, `useRef`
  - `lucide-react` — `Receipt`, `Lock`, `LockOpen`, `Loader2`, `Check`, `TrendingUp`, …
  - `sonner` — `toast`

## Used by

- `components/dashboard/inlineApps/teamforce/TeamforceApp.tsx`
