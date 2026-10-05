# `app/checkout/product/[productId]/ProductCheckoutPage.tsx`

> React component `ProductCheckoutPage`.

**Kind:** Next.js app-directory module (colocated) · **Lines:** 1310 · **Directive:** `"use client"`

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Composition

**Renders:** `Input`×11 (components/ui/input.tsx), `Loader2`×5 (lucide-react), `Button`×4 (components/ui/button.tsx), `CheckCircle`×2 (lucide-react), `ArrowRight`×2 (lucide-react), `AlertCircle` (lucide-react), `UserPlus` (lucide-react), `CheckoutPaymentStep` (components/checkout/CheckoutPaymentStep.tsx), `Lock` (lucide-react), `MapPin` (lucide-react), `Mail` (lucide-react), `KeyRound` (lucide-react), `User` (lucide-react), `CouponInput` (components/ui/coupon-input.tsx), `Shield` (lucide-react)

### Props

- **`ProductCheckoutPage`**: `productId: string`

**Hooks used:** `useState`×24, `useEffect`×2, `useRouter` (next/navigation), `useGstQuote` (lib/hooks/useGstQuote.ts)

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `ProductCheckoutPage` | component | `ProductCheckoutPage({ productId }: { productId: string })` | 94 |

## Interfaces

- **Backend endpoints called (via `/backend`):**
  - `POST /backend/checkout/product/${productId}/verify-session` (L186)
  - `GET /backend/affiliate/referrer-info?${query}` (L250)
  - `GET /backend/checkout/product/${productId}` (L270)
  - `POST /backend/checkout/product/${productId}/request-otp` (L298)
  - `POST /backend/checkout/product/${productId}/verify-otp` (L333)
  - `POST /backend/checkout/product/${productId}/process-checkout` (L399)
  - `POST /backend/bat246/office/join` (L793)
- **Environment variables (`process.env`):** `NEXT_PUBLIC_API_URL`
- **Browser storage / cookies:** `garage_tok` (localStorage: get/set), `checkout_token` (localStorage: set/get), `checkout_org_id` (localStorage: set/get)
- **Timers / queues:** `setTimeout` at L449, L743

## Dependencies

- **Internal:**
  - `components/ui/button.tsx` — `Button`
  - `components/ui/input.tsx` — `Input`
  - `components/ui/coupon-input.tsx` — `CouponInput`, `AppliedCoupon`
  - `lib/auth.ts` — `saveToken`, `saveOrgId`, `getUserDataFromToken`
  - `lib/api.ts` — `API_URL`
  - `lib/hooks/useGstQuote.ts` — `useGstQuote`
  - `components/checkout/CheckoutPaymentStep.tsx` — `CheckoutPaymentStep`
  - `lib/sanitizeDescription.ts` — `sanitizeDescription`
- **Packages:**
  - `react` — `useState`, `useEffect`
  - `next` — `useRouter`
  - `lucide-react` — `Loader2`, `Mail`, `KeyRound`, `User`, `CheckCircle`, `AlertCircle`, …
  - `sonner` — `toast`

## Used by

- `app/checkout/product/[productId]/page.tsx`

## Notes

- Security-relevant constructs: `dangerouslySetInnerHTML` (L572).
