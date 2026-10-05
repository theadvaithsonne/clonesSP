# `components/coverfi/products/ProductWizard.tsx`

> React component `ProductWizard`.

**Kind:** React component · **Lines:** 866 · **Directive:** `"use client"`

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Composition

**Renders:** `Label`×12 (components/ui/label.tsx), `Button`×11 (components/ui/button.tsx), `Select`×5 (components/ui/select.tsx), `SelectTrigger`×5 (components/ui/select.tsx), `SelectValue`×5 (components/ui/select.tsx), `SelectContent`×5 (components/ui/select.tsx), `SelectItem`×5 (components/ui/select.tsx), `Input`×5 (components/ui/input.tsx), `Plus`×3 (lucide-react), `Badge`×3 (components/ui/badge.tsx), `Loader2`×2 (lucide-react), `Textarea`×2 (components/ui/textarea.tsx), `X`×2 (lucide-react), `Stepper` (local), `CategoryStep` (local), `FiltersStep` (local), `InfoStep` (local), `BillingStep` (local), `Check` (lucide-react), `ChevronRight` (lucide-react), `CategoryFormDialog` (components/coverfi/products/CategoryFormDialog.tsx), `Link` (next/link), `ImageUpload` (components/coverfi/brokerage/ImageUpload.tsx)

### Props

- **`ProductWizard`**: `productId: string`

**Hooks used:** `useState`×19, `useEffect`×4, `useRouter` (next/navigation)

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `default (ProductWizard)` | component | `ProductWizard({ productId }: Props)` | 61 |

## Interfaces

None detected: no endpoints, events, data access or environment reads were found.

## Dependencies

- **Internal:**
  - `components/ui/button.tsx` — `Button`
  - `components/ui/input.tsx` — `Input`
  - `components/ui/label.tsx` — `Label`
  - `components/ui/textarea.tsx` — `Textarea`
  - `components/ui/badge.tsx` — `Badge`
  - `components/ui/select.tsx` — `Select`, `SelectContent`, `SelectItem`, `SelectTrigger`, `SelectValue`
  - `components/coverfi/brokerage/ImageUpload.tsx` — `ImageUpload (default)`
  - `lib/coverfi/uploadFile.ts` — `uploadFile`
  - `lib/coverfi/insurance-api.ts` — `listInsuranceCompanies`
  - `lib/coverfi/products-api.ts` — `getProduct`, `listCategories`, `createCategory`, `listFilterTypes`, `listFilterItemsForType`, `stepCategory`, `stepFilters`, `stepInfo`, … +1
  - `lib/coverfi/types.ts` — `BILLING_TYPES`, `PAYMENT_FREQUENCIES`, `WAIVER_TYPES`, `BillingType`, `FilterItem`, `FilterType`, `InsuranceCompany`, `PaymentFrequency`, … +3
  - `lib/utils.ts` — `cn`
  - `components/coverfi/products/CategoryFormDialog.tsx` — `CategoryFormDialog (default)`
- **Packages:**
  - `react` — `useEffect`, `useState`
  - `next` — `useRouter`
  - `lucide-react` — `Check`, `ChevronRight`, `Loader2`, `Plus`, `X`
  - `sonner` — `toast`

## Used by

- `app/(dashboard)/coverfi/products/[id]/page.tsx`
