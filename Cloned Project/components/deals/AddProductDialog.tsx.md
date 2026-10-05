# `components/deals/AddProductDialog.tsx`

> React component `AddProductDialog`.

**Kind:** React component · **Lines:** 255 · **Directive:** `"use client"`

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Composition

**Renders:** `Dialog` (components/ui/dialog.tsx), `DialogContent` (components/ui/dialog.tsx), `DialogTitle` (components/ui/dialog.tsx), `X` (lucide-react), `Loader2` (lucide-react), `Search` (lucide-react), `Input` (components/ui/input.tsx), `Button` (components/ui/button.tsx)

### Props

- **`AddProductDialog`**: `open: boolean`, `onOpenChange: (open: boolean) => void`, `products: AddProductOption[]`, `selections: ProductSelection[]`, `searchQuery: string`, `onSearchChange: (query: string) => void`, `onToggleProduct: (productId: string) => void`, `onQuantityChange: (productId: string, quantity: string) => void`, `onSave: () => void`, `isEdit?: boolean`, `isLoading?: boolean`, `isSubmitting?: boolean`

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `AddProductOption` | type |  | 13 |
| `ProductSelection` | type |  | 19 |
| `AddProductDialog` | component | `AddProductDialog({ open, onOpenChange, products, selections, searchQuery, on…)` | 43 |

## Interfaces

None detected: no endpoints, events, data access or environment reads were found.

## Dependencies

- **Internal:**
  - `components/ui/button.tsx` — `Button`
  - `components/ui/dialog.tsx` — `Dialog`, `DialogContent`, `DialogTitle`
  - `components/ui/input.tsx` — `Input`
  - `components/deals/LeadDetailFigmaView.tsx` — `FIGMA`
- **Packages:**
  - `lucide-react` — `Loader2`, `Search`, `X`

## Used by

- `app/(dashboard)/deals/leads/[id]/page.tsx`
