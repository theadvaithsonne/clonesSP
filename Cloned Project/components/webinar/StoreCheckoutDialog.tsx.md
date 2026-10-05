# `components/webinar/StoreCheckoutDialog.tsx`

> React component `StoreCheckoutDialog`.

**Kind:** React component · **Lines:** 428 · **Directive:** `"use client"`

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Composition

**Renders:** `Field`×9 (local), `ShoppingBag`×2 (lucide-react), `Check` (lucide-react), `ExternalLink` (lucide-react), `X` (lucide-react), `Loader2` (lucide-react)

### Props

- **`StoreCheckoutDialog`**: `item: PinnedItem`, `displayCurrency?: DisplayCurrency`, `liveWorkshopId?: string`, `liveSessionDate?: string`, `onClose: () => void`

**Hooks used:** `useState`×7, `useEffect`, `useMemo`

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `default (StoreCheckoutDialog)` | component | `StoreCheckoutDialog({ item, displayCurrency = 'USD', liveWorkshopId, liveSessio…)` — Minimal checkout dialog for physical storefront items. | 79 |

## Interfaces

- **External HTTP calls:**
  - `POST test.garage.app/api/ecommerce/invoices` (L157)
- **Environment variables (`process.env`):** `NEXT_PUBLIC_GARAGE_API_URL`
- **External hosts mentioned in the code:** `test.garage.app`

## Dependencies

- **Internal:**
  - `lib/auth.ts` — `getToken`, `getUserDataFromToken`
  - `store/webinarStore.ts` — `PinnedProduct`, `(types only)`
  - `lib/webinar/currency.ts` — `CURRENCY_SYMBOL`, `convertPrice`, `formatPrice`, `DisplayCurrency`
- **Packages:**
  - `react` — `useEffect`, `useMemo`, `useState`
  - `react-dom` — `createPortal`
  - `lucide-react` — `X`, `Loader2`, `ShoppingBag`, `Check`, `ExternalLink`

## Used by

- `app/webinar/[id]/WebinarRoomClient.tsx`
