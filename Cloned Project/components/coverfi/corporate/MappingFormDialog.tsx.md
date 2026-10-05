# `components/coverfi/corporate/MappingFormDialog.tsx`

> React component `MappingFormDialog`.

**Kind:** React component · **Lines:** 323 · **Directive:** `"use client"`

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Composition

**Renders:** `Field`×5 (local), `Input`×3 (components/ui/input.tsx), `Button`×2 (components/ui/button.tsx), `Dialog` (components/ui/dialog.tsx), `DialogContent` (components/ui/dialog.tsx), `DialogHeader` (components/ui/dialog.tsx), `DialogTitle` (components/ui/dialog.tsx), `Select` (components/ui/select.tsx), `SelectTrigger` (components/ui/select.tsx), `SelectValue` (components/ui/select.tsx), `SelectContent` (components/ui/select.tsx), `SelectItem` (components/ui/select.tsx), `X` (lucide-react), `Textarea` (components/ui/textarea.tsx), `DialogFooter` (components/ui/dialog.tsx), `Label` (components/ui/label.tsx)

### Props

- **`MappingFormDialog`**: `open: boolean`, `onClose: () => void`, `onSaved: () => void`, `corporateId: string`, `existing?: CorporateProductMapping | null`

**Hooks used:** `useState`×4, `useEffect`×2, `useMemo`

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `default (MappingFormDialog)` | component | `MappingFormDialog({ open, onClose, onSaved, corporateId, existing, }: Props)` | 57 |

## Interfaces

None detected: no endpoints, events, data access or environment reads were found.

## Dependencies

- **Internal:**
  - `components/ui/dialog.tsx` — `Dialog`, `DialogContent`, `DialogFooter`, `DialogHeader`, `DialogTitle`
  - `components/ui/input.tsx` — `Input`
  - `components/ui/label.tsx` — `Label`
  - `components/ui/textarea.tsx` — `Textarea`
  - `components/ui/button.tsx` — `Button`
  - `components/ui/badge.tsx` — `Badge`
  - `components/ui/select.tsx` — `Select`, `SelectContent`, `SelectItem`, `SelectTrigger`, `SelectValue`
  - `lib/coverfi/corporate-api.ts` — `createMapping`, `updateMapping`, `listCorporateEmployees`
  - `lib/coverfi/products-api.ts` — `listProducts`
  - `lib/coverfi/types.ts` — `CorporateEmployee`, `CorporateProductMapping`, `Product`, `(types only)`
  - `lib/utils.ts` — `cn`
- **Packages:**
  - `react` — `useEffect`, `useMemo`, `useState`
  - `lucide-react` — `X`
  - `sonner` — `toast`

## Used by

- `components/coverfi/corporate/CorporateProductsTab.tsx`
- `components/coverfi/corporate/CorporateStep4Products.tsx`
