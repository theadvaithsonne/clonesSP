# `components/coverfi/corporate/CorporateProductsTab.tsx`

> React component `CorporateProductsTab`.

**Kind:** React component · **Lines:** 209 · **Directive:** `"use client"`

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Composition

**Renders:** `TableCell`×8 (components/ui/table.tsx), `TableHead`×6 (components/ui/table.tsx), `TableRow`×4 (components/ui/table.tsx), `Button`×3 (components/ui/button.tsx), `Plus` (lucide-react), `Table` (components/ui/table.tsx), `TableHeader` (components/ui/table.tsx), `TableBody` (components/ui/table.tsx), `Badge` (components/ui/badge.tsx), `Pencil` (lucide-react), `Trash2` (lucide-react), `MappingFormDialog` (components/coverfi/corporate/MappingFormDialog.tsx)

### Props

- **`CorporateProductsTab`**: `corporateId: string`, `onChanged: () => Promise<void> | void`

**Hooks used:** `useState`×6, `useMemo`×2, `useEffect`

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `default (CorporateProductsTab)` | component | `CorporateProductsTab({ corporateId, onChanged, }: Props)` | 34 |

## Interfaces

None detected: no endpoints, events, data access or environment reads were found.

## Dependencies

- **Internal:**
  - `components/ui/button.tsx` — `Button`
  - `components/ui/badge.tsx` — `Badge`
  - `components/ui/table.tsx` — `Table`, `TableBody`, `TableCell`, `TableHead`, `TableHeader`, `TableRow`
  - `components/coverfi/corporate/MappingFormDialog.tsx` — `MappingFormDialog (default)`
  - `lib/coverfi/corporate-api.ts` — `listMappingsForCorporate`, `deleteMapping`
  - `lib/coverfi/products-api.ts` — `listProducts`
  - `lib/coverfi/insurance-api.ts` — `listInsuranceCompanies`
  - `lib/coverfi/types.ts` — `CorporateProductMapping`, `InsuranceCompany`, `Product`, `(types only)`
- **Packages:**
  - `react` — `useEffect`, `useMemo`, `useState`
  - `lucide-react` — `Plus`, `Trash2`, `Pencil`
  - `sonner` — `toast`

## Used by

- `components/coverfi/corporate/CorporateDetail.tsx`
