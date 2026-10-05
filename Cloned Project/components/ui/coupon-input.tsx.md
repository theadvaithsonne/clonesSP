# `components/ui/coupon-input.tsx`

> React components `CouponInput`, `CouponInput`.

**Kind:** UI primitive (shadcn/Radix wrapper) · **Lines:** 300 · **Directive:** `"use client"`

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Composition

**Renders:** `X`×2 (lucide-react), `Sparkles` (lucide-react), `Check` (lucide-react), `Percent` (lucide-react), `Tag` (lucide-react), `Input` (components/ui/input.tsx), `Button` (components/ui/button.tsx), `Loader2` (lucide-react)

### Props

- **`CouponInput`**: `itemType: string`, `itemId: string`, `amount: number`, `currency?: string`, `onCouponApplied?: (coupon: AppliedCoupon) => void`, `onCouponRemoved?: () => void`, `orgId?: string`, `userId?: string`, `className?: string`, `disabled?: boolean`

**Hooks used:** `useState`×4, `useCallback`

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `CouponValidationResult` | interface |  | 11 |
| `AppliedCoupon` | interface |  | 24 |
| `CouponInput` | component | `CouponInput({ itemType, itemId, amount, currency = "USD", onCouponAppli…)` | 55 |
| `default (CouponInput)` | component | `CouponInput({ itemType, itemId, amount, currency = "USD", onCouponAppli…)` | 299 |

## Interfaces

- **Backend endpoints called (via `/backend`):**
  - `POST /backend/checkout/validate-platform-coupon` (L98)
  - `POST /backend/checkout/validate-coupon` (L152)

## Dependencies

- **Internal:**
  - `components/ui/input.tsx` — `Input`
  - `components/ui/button.tsx` — `Button`
  - `lib/utils.ts` — `cn`
  - `lib/api.ts` — `API_URL`
- **Packages:**
  - `react` — `useState`, `useCallback`
  - `lucide-react` — `Loader2`, `Tag`, `Check`, `X`, `Percent`, `Sparkles`

## Used by

- `app/checkout/call/[callId]/CallCheckoutPage.tsx`
- `app/checkout/channel/[channelId]/ChannelCheckoutPage.tsx`
- `app/checkout/course/[courseId]/CourseCheckoutPage.tsx`
- `app/checkout/product/[productId]/ProductCheckoutPage.tsx`
- `app/checkout/service/[serviceId]/ServiceCheckoutPage.tsx`
- `app/checkout/workshop/[workshopId]/WorkshopCheckoutPage.tsx`
- `components/dashboard/ManagementPage.tsx`
