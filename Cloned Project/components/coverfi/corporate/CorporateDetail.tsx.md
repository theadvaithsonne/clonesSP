# `components/coverfi/corporate/CorporateDetail.tsx`

> React component `CorporateDetail`.

**Kind:** React component · **Lines:** 156 · **Directive:** `"use client"`

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Composition

**Renders:** `Link` (next/link), `ArrowLeft` (lucide-react), `Landmark` (lucide-react), `CorporateCodeBadge` (local), `Badge` (components/ui/badge.tsx), `Icon` (local), `CorporateInfoTab` (components/coverfi/corporate/CorporateInfoTab.tsx), `CorporateEmployeesTab` (components/coverfi/corporate/CorporateEmployeesTab.tsx), `CorporateProductsTab` (components/coverfi/corporate/CorporateProductsTab.tsx), `Check` (lucide-react), `Copy` (lucide-react)

### Props

- **`CorporateDetail`**: `corporate: Corporate`, `onReload: () => Promise<void> | void`

**Hooks used:** `useState`×2

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `default (CorporateDetail)` | component | `CorporateDetail({ corporate, onReload }: Props)` | 29 |

## Interfaces

- **Timers / queues:** `setTimeout` at L135

## Dependencies

- **Internal:**
  - `components/ui/badge.tsx` — `Badge`
  - `lib/utils.ts` — `cn`
  - `lib/coverfi/types.ts` — `Corporate`, `(types only)`
  - `components/coverfi/corporate/CorporateInfoTab.tsx` — `CorporateInfoTab (default)`
  - `components/coverfi/corporate/CorporateEmployeesTab.tsx` — `CorporateEmployeesTab (default)`
  - `components/coverfi/corporate/CorporateProductsTab.tsx` — `CorporateProductsTab (default)`
- **Packages:**
  - `react` — `useState`
  - `next`
  - `lucide-react` — `ArrowLeft`, `Landmark`, `Users`, `ShieldCheck`, `Info as InfoIcon`, `Copy`, …
  - `sonner` — `toast`

## Used by

- `components/coverfi/corporate/CorporateWizard.tsx`
