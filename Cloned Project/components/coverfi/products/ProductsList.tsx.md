# `components/coverfi/products/ProductsList.tsx`

> React component `ProductsList`.

**Kind:** React component · **Lines:** 221 · **Directive:** `"use client"`

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Composition

**Renders:** `TableCell`×9 (components/ui/table.tsx), `TableHead`×7 (components/ui/table.tsx), `TableRow`×4 (components/ui/table.tsx), `Button`×3 (components/ui/button.tsx), `Link`×2 (next/link), `Badge`×2 (components/ui/badge.tsx), `Plus` (lucide-react), `Table` (components/ui/table.tsx), `TableHeader` (components/ui/table.tsx), `TableBody` (components/ui/table.tsx), `ImageIcon` (lucide-react), `FileText` (lucide-react), `Pencil` (lucide-react), `Trash2` (lucide-react)

**Hooks used:** `useState`×5, `useMemo`×2, `useRouter` (next/navigation), `useEffect`

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `default (ProductsList)` | component | `ProductsList()` | 31 |

## Interfaces

None detected: no endpoints, events, data access or environment reads were found.

## Dependencies

- **Internal:**
  - `components/ui/button.tsx` — `Button`
  - `components/ui/badge.tsx` — `Badge`
  - `components/ui/table.tsx` — `Table`, `TableBody`, `TableCell`, `TableHead`, `TableHeader`, `TableRow`
  - `lib/coverfi/products-api.ts` — `listProducts`, `deleteProduct`, `listCategories`, `createDraftProduct`
  - `lib/coverfi/insurance-api.ts` — `listInsuranceCompanies`
  - `lib/coverfi/types.ts` — `InsuranceCompany`, `Product`, `ProductCategory`, `(types only)`
- **Packages:**
  - `react` — `useEffect`, `useState`, `useMemo`
  - `next` — `useRouter`
  - `lucide-react` — `Plus`, `Pencil`, `Trash2`, `ImageIcon`, `FileText`
  - `sonner` — `toast`

## Used by

- `app/(dashboard)/coverfi/products/page.tsx`
