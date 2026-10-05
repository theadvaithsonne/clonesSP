# `components/webinar/PinnedProductCard.tsx`

> React component `PinnedProductCard`.

**Kind:** React component · **Lines:** 479 · **Directive:** `"use client"`

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Composition

**Renders:** `ShoppingBag`×3 (lucide-react), `Timer`×2 (lucide-react), `Check`×2 (lucide-react), `Minus` (lucide-react), `X` (lucide-react), `Package` (lucide-react), `Loader2` (lucide-react), `Repeat` (lucide-react)

### Props

- **`PinnedProductCard`**: `onBuy: (displayCurrency: DisplayCurrency | null) => Promise<void> | v…`, `onUnpin?: () => void`, `onSwap?: () => void`, `onExpired?: () => void`, `buyState: BuyState`

**Hooks used:** `useState`×5, `useEffect`×5, `useMemo`×3, `useWebinarStore`×2 (store/webinarStore.ts), `useRouter` (next/navigation), `useRef`

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `default (PinnedProductCard)` | component | `PinnedProductCard({ onBuy, onUnpin, onSwap, onExpired, buyState, }: Props)` | 52 |

## Interfaces

- **Timers / queues:** `setInterval` at L72

## Dependencies

- **Internal:**
  - `lib/webinar/magic-link.ts` — `createMagicLink`, `readMagicLink`
  - `lib/webinar/garage-store-plans.ts` — `resolveGarageStoreItem`, `parseGarageStoreId`, `offerPrice`, `resolveTermMonths`, `PlanOffer`, `OfficeOffer`
  - `lib/auth.ts` — `getOrgId`
  - `store/webinarStore.ts` — `useWebinarStore (default)`
  - `lib/auth.ts` — `getToken`, `getUserDataFromToken`
  - `lib/webinar/currency.ts` — `CURRENCY_SYMBOL`, `convertPrice`, `formatPrice`, `DisplayCurrency`
  - `lib/webinar/html-text.ts` — `htmlToPlainText`
- **Packages:**
  - `react` — `useEffect`, `useMemo`, `useRef`, `useState`
  - `next` — `useRouter`
  - `lucide-react` — `Package`, `ShoppingBag`, `X`, `Minus`, `Repeat`, `Loader2`, …

## Used by

- `app/webinar/[id]/WebinarRoomClient.tsx`
