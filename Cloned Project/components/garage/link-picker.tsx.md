# `components/garage/link-picker.tsx`

> React component `LinkPicker`.

**Kind:** React component · **Lines:** 289 · **Directive:** `"use client"`

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Composition

**Renders:** `Search` (lucide-react), `Loader2` (lucide-react), `GeneralCard` (local), `OfficeCard` (components/shared/office-card.tsx), `ProductCard` (components/shared/product-card.tsx), `Icon` (local)

### Props

- **`LinkPicker`**: `value: string | null`, `onChange: (item: LinkItem | null) => void`, `affiliateIdOverride?: string | null`

**Hooks used:** `useState`×6, `useMemo`×4, `useEffect`×2, `useDeferredValue`

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `LinkPicker` | component | `LinkPicker({ value, onChange, affiliateIdOverride, }: { value: string …)` | 29 |

## Interfaces

None detected: no endpoints, events, data access or environment reads were found.

## Dependencies

- **Internal:**
  - `lib/affiliate/links-api.ts` — `getAffiliateCatalog`, `getOfficeItems`, `getGeneralLinkItems`, `LinkItem`
  - `lib/api/garage.ts` — `fetchMyAffiliateId`
  - `lib/affiliate/link-card-adapters.ts` — `linkToProductCardItem`, `linkToOfficeCardItem`
  - `components/shared/product-card.tsx` — `ProductCard`
  - `components/shared/office-card.tsx` — `OfficeCard`
  - `lib/utils.ts` — `cn`
- **Packages:**
  - `react` — `useEffect`, `useMemo`, `useState`, `useDeferredValue`
  - `lucide-react` — `Search`, `Loader2`, `Globe`, `Smartphone`
  - `framer-motion` — `motion`

## Used by

- `components/garage/attach-product-drawer.tsx`
