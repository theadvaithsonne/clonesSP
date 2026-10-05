# `components/webinar/ShopPanel.tsx`

> React component `ShopPanel`.

**Kind:** React component · **Lines:** 318 · **Directive:** `"use client"`

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Composition

**Renders:** `Loader2`×2 (lucide-react), `Search` (lucide-react), `X` (lucide-react), `ShoppingBag` (lucide-react)

### Props

- **`ShopPanel`**: `orgId: string | null`, `onBuy: (item: Sellable) => void`, `busyItemId?: string | null`

**Hooks used:** `useState`×5, `useMemo`×2, `useEffect`

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `default (ShopPanel)` | component | `ShopPanel({ orgId, onBuy, busyItemId }: ShopPanelProps)` — The host's storefront, in the sidebar. | 91 |

## Interfaces

None detected: no endpoints, events, data access or environment reads were found.

## Dependencies

- **Internal:**
  - `lib/feed-api.ts` — `listOrgSellables`, `Sellable`, `SellableItemType`
  - `lib/webinar/store-sellables.ts` — `listOrgStoreProducts`
  - `lib/webinar/html-text.ts` — `htmlToPlainText`
- **Packages:**
  - `react` — `useEffect`, `useMemo`, `useState`
  - `lucide-react` — `Loader2`, `Search`, `ShoppingBag`, `X`

## Used by

- `app/webinar/[id]/WebinarRoomClient.tsx`
