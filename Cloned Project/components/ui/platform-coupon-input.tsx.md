# `components/ui/platform-coupon-input.tsx`

> React component `PlatformCouponInput`.

**Kind:** UI primitive (shadcn/Radix wrapper) · **Lines:** 317 · **Directive:** `"use client"`

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Composition

**Renders:** `X`×2 (lucide-react), `Check` (lucide-react), `Sparkles` (lucide-react), `TicketPercent` (lucide-react), `Input` (components/ui/input.tsx), `Button` (components/ui/button.tsx), `Loader2` (lucide-react)

### Props

- **`PlatformCouponInput`**: `productType: PlatformProductType`, `amountCents: number`, `userId?: string`, `orgId?: string | { _id?: string } | null`, `itemId?: string | { _id?: string } | null`, `invoiceCurrency?: "USD" | "INR"`, `onApplied?: (applied: AppliedPlatformCoupon) => void | Promise<void>`, `onRemoved?: () => void`, `disabled?: boolean`, `className?: string`, `authToken?: string`

**Hooks used:** `useState`×4, `useCallback`×2

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `PlatformProductType` | type |  | 11 |
| `couponProductTypeForItem` | function | `couponProductTypeForItem(itemType: string \| undefined): PlatformProductType \| undefined` — Map an invoice line item's itemType (from the Invoice schema) to the platform-coupon productType. | 31 |
| `AppliedPlatformCoupon` | interface |  | 52 |
| `PlatformCouponInput` | component | `PlatformCouponInput({ productType, amountCents, userId, orgId, itemId, invoiceC…)` | 108 |

## Interfaces

- **Backend endpoints called (via `/backend`):**
  - `POST /backend/checkout/validate-platform-coupon` (L148)

## Dependencies

- **Internal:**
  - `components/ui/input.tsx` — `Input`
  - `components/ui/button.tsx` — `Button`
  - `lib/utils.ts` — `cn`
  - `lib/api.ts` — `API_URL`
- **Packages:**
  - `react` — `useState`, `useCallback`
  - `lucide-react` — `Loader2`, `TicketPercent`, `Check`, `X`, `Sparkles`

## Used by

- `app/(dashboard)/games/bat246/boards/page.tsx`
- `components/checkout/CheckoutPaymentStep.tsx`
- `components/dashboard/CallsPage.tsx`
- `components/dashboard/ChannelPaymentModalNew.tsx`
- `components/dashboard/CoursesPage.tsx`
- `components/dashboard/WalletPageNew.tsx`
