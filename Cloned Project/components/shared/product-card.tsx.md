# `components/shared/product-card.tsx`

> React component `ProductCard`.

**Kind:** React component · **Lines:** 212 · **Directive:** `"use client"`

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Composition

**Renders:** `Field`×4 (local), `PlatformMark` (components/icons/platform-logos.tsx), `SellerAvatar` (local)

### Props

- **`ProductCard`**: `item: ProductCardItem`, `selected?: boolean`, `dimmed?: boolean`, `onClick?: () => void`

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `ProductCardItem` | interface | The one canonical product card, shared across EarnGPT, Opportunities and the Links page (#41). | 17 |
| `CatalogRowLike` | type | A catalog row shape (CatalogBrowseItem / ProductSuggestion) → the card item. | 41 |
| `toProductCardItem` | function | `toProductCardItem(row: CatalogRowLike): ProductCardItem` | 50 |
| `ProductCard` | component | `ProductCard({ item, selected, dimmed, onClick, }: { item: ProductCardIt…)` | 77 |

## Interfaces

None detected: no endpoints, events, data access or environment reads were found.

## Dependencies

- **Internal:**
  - `lib/utils.ts` — `cn`
  - `lib/money/format-money.ts` — `deriveProductCommercials`, `ProductCommercialRow`
  - `components/icons/platform-logos.tsx` — `PlatformMark`, `isPlatformProductType`
- **Packages:**
  - `framer-motion` — `motion`

## Used by

- `components/garage/link-picker.tsx`
- `lib/affiliate/link-card-adapters.ts`
