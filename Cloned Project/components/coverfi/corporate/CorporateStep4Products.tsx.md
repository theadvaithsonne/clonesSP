# `components/coverfi/corporate/CorporateStep4Products.tsx`

> React component `CorporateStep4Products`.

**Kind:** React component · **Lines:** 236 · **Directive:** `"use client"`

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Composition

**Renders:** `TableCell`×8 (components/ui/table.tsx), `TableHead`×6 (components/ui/table.tsx), `Button`×4 (components/ui/button.tsx), `TableRow`×4 (components/ui/table.tsx), `Plus` (lucide-react), `Table` (components/ui/table.tsx), `TableHeader` (components/ui/table.tsx), `TableBody` (components/ui/table.tsx), `Badge` (components/ui/badge.tsx), `Trash2` (lucide-react), `ShieldCheck` (lucide-react), `MappingFormDialog` (components/coverfi/corporate/MappingFormDialog.tsx)

### Props

- **`CorporateStep4Products`**: `corporate: Corporate`, `onFinish: () => void`, `onBack: () => void`

**Hooks used:** `useState`×7, `useMemo`×2, `useEffect`

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `default (CorporateStep4Products)` | component | `CorporateStep4Products({ corporate, onFinish, onBack, }: Props)` | 37 |

## Interfaces

None detected: no endpoints, events, data access or environment reads were found.

## Dependencies

- **Internal:**
  - `components/ui/button.tsx` — `Button`
  - `components/ui/badge.tsx` — `Badge`
  - `components/ui/table.tsx` — `Table`, `TableBody`, `TableCell`, `TableHead`, `TableHeader`, `TableRow`
  - `components/coverfi/corporate/MappingFormDialog.tsx` — `MappingFormDialog (default)`
  - `lib/coverfi/corporate-api.ts` — `listMappingsForCorporate`, `deleteMapping`, `createCorporateStep4`
  - `lib/coverfi/products-api.ts` — `listProducts`
  - `lib/coverfi/insurance-api.ts` — `listInsuranceCompanies`
  - `lib/coverfi/types.ts` — `Corporate`, `CorporateProductMapping`, `InsuranceCompany`, `Product`, `(types only)`
- **Packages:**
  - `react` — `useEffect`, `useMemo`, `useState`
  - `lucide-react` — `Plus`, `Trash2`, `ShieldCheck`
  - `sonner` — `toast`

## Used by

- `components/coverfi/corporate/CorporateWizard.tsx`
