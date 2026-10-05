# `components/webinar/ProductPickerDialog.tsx`

> React component `ProductPickerDialog`.

**Kind:** React component · **Lines:** 923 · **Directive:** `"use client"`

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Composition

**Renders:** `Icon`×3 (local), `StoreIcon`×2 (lucide-react), `SellableThumb`×2 (local), `TypeBadge`×2 (local), `Dialog` (components/ui/dialog.tsx), `DialogContent` (components/ui/dialog.tsx), `DialogHeader` (components/ui/dialog.tsx), `DialogTitle` (components/ui/dialog.tsx), `DialogDescription` (components/ui/dialog.tsx), `Popover` (components/ui/popover.tsx), `PopoverTrigger` (components/ui/popover.tsx), `ListFilter` (lucide-react), `PopoverContent` (components/ui/popover.tsx), `Checkbox` (components/ui/checkbox.tsx), `Package` (lucide-react), `ArrowLeft` (lucide-react)

### Props

- **`ProductPickerDialog`**: `open: boolean`, `onOpenChange: (open: boolean) => void`, `onPick: ( item: Sellable, durationMinutes: number | null, auction?: A…`

**Hooks used:** `useState`×13, `useMemo`×3, `useCallback`×2, `useEffect`

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `default (ProductPickerDialog)` | component | `ProductPickerDialog({ open, onOpenChange, onPick }: Props)` | 127 |
| `Sellable` | export |  | 922 |

## Interfaces

None detected: no endpoints, events, data access or environment reads were found.

## Dependencies

- **Internal:**
  - `components/ui/dialog.tsx` — `Dialog`, `DialogContent`, `DialogDescription`, `DialogHeader`, `DialogTitle`
  - `components/ui/popover.tsx` — `Popover`, `PopoverContent`, `PopoverTrigger`
  - `components/ui/checkbox.tsx` — `Checkbox`
  - `lib/feed-api.ts` — `listOrgSellables`, `Sellable`, `SellableItemType`
  - `lib/webinar/store-sellables.ts` — `listOrgStoreProducts`
  - `lib/webinar/html-text.ts` — `htmlToPlainText`
  - `lib/webinar/garage-store-plans.ts` — `getUnilevelPlusProduct`, `listOfficePlans`
  - `lib/auth.ts` — `getUserDataFromToken`
  - `lib/webinar/currency.ts` — `CURRENCY_SYMBOL`, `convertPrice`, `formatPrice`, `DisplayCurrency`
  - `lib/api/auctions.ts` — `AuctionRoundConfig`, `(types only)`
- **Packages:**
  - `react` — `useCallback`, `useEffect`, `useMemo`, `useState`
  - `lucide-react` — `Package`, `ArrowLeft`, `Users`, `GraduationCap`, `Wrench`, `Presentation`, …

## Used by

- `app/webinar/[id]/WebinarRoomClient.tsx`
- `components/webinar/ControlBar.tsx`
