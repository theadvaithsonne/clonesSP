# `app/checkout/service/[serviceId]/ServiceCheckoutPage.tsx`

> React component `ServiceCheckoutPage`.

**Kind:** Next.js app-directory module (colocated) · **Lines:** 813 · **Directive:** `"use client"`

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Composition

**Renders:** `Loader2`×5 (lucide-react), `Button`×5 (components/ui/button.tsx), `ArrowRight`×5 (lucide-react), `CheckCircle`×3 (lucide-react), `Briefcase`×3 (lucide-react), `Input`×3 (components/ui/input.tsx), `Clock`×2 (lucide-react), `AlertCircle` (lucide-react), `CheckoutPaymentStep` (components/checkout/CheckoutPaymentStep.tsx), `Target` (lucide-react), `UserPlus` (lucide-react), `Mail` (lucide-react), `KeyRound` (lucide-react), `User` (lucide-react), `CouponInput` (components/ui/coupon-input.tsx), `Shield` (lucide-react), `DollarSign` (lucide-react)

### Props

- **`ServiceCheckoutPage`**: `serviceId: string`

**Hooks used:** `useState`×15, `useEffect`×2, `useRouter` (next/navigation)

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `ServiceCheckoutPage` | component | `ServiceCheckoutPage({ serviceId }: { serviceId: string })` | 79 |

## Interfaces

- **Backend endpoints called (via `/backend`):**
  - `GET /backend/affiliate/referrer-info?affiliateId=${referralId}` (L123)
  - `GET /backend/checkout/service/${serviceId}` (L139)
  - `POST /backend/checkout/service/${serviceId}/init` (L163)
  - `POST /backend/checkout/service/${serviceId}/verify-otp` (L192)
  - `POST /backend/checkout/service/${serviceId}/update-profile` (L241)
  - `POST /backend/checkout/service/${serviceId}/opt-in` (L267)
- **Browser storage / cookies:** `checkout_token` (localStorage: set/get), `checkout_org_id` (localStorage: set/get)

## Dependencies

- **Internal:**
  - `components/ui/button.tsx` — `Button`
  - `components/ui/input.tsx` — `Input`
  - `lib/auth.ts` — `saveToken`, `saveOrgId`
  - `lib/api.ts` — `API_URL`
  - `components/checkout/CheckoutPaymentStep.tsx` — `CheckoutPaymentStep`
  - `components/ui/coupon-input.tsx` — `CouponInput`, `AppliedCoupon`
- **Packages:**
  - `react` — `useState`, `useEffect`
  - `next` — `useRouter`
  - `lucide-react` — `Loader2`, `Mail`, `KeyRound`, `User`, `CheckCircle`, `AlertCircle`, …
  - `sonner` — `toast`

## Used by

- `app/checkout/service/[serviceId]/page.tsx`
