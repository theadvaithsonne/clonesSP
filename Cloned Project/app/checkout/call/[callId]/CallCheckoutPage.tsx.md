# `app/checkout/call/[callId]/CallCheckoutPage.tsx`

> React component `CallCheckoutPage`.

**Kind:** Next.js app-directory module (colocated) · **Lines:** 970 · **Directive:** `"use client"`

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Composition

**Renders:** `Button`×9 (components/ui/button.tsx), `Loader2`×5 (lucide-react), `Input`×3 (components/ui/input.tsx), `CheckCircle`×2 (lucide-react), `ArrowRight`×2 (lucide-react), `Label`×2 (components/ui/label.tsx), `ArrowLeft`×2 (lucide-react), `AlertCircle` (lucide-react), `Video` (lucide-react), `Clock` (lucide-react), `Star` (lucide-react), `Users` (lucide-react), `UserPlus` (lucide-react), `CheckoutPaymentStep` (components/checkout/CheckoutPaymentStep.tsx), `Mail` (lucide-react), `KeyRound` (lucide-react), `User` (lucide-react), `Textarea` (components/ui/textarea.tsx), `CouponInput` (components/ui/coupon-input.tsx), `Shield` (lucide-react)

### Props

- **`CallCheckoutPage`**: `callId: string`

**Hooks used:** `useState`×16, `useEffect`×2, `useRouter` (next/navigation)

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `CallCheckoutPage` | component | `CallCheckoutPage({ callId }: { callId: string })` | 81 |

## Interfaces

- **Backend endpoints called (via `/backend`):**
  - `GET /backend/affiliate/referrer-info?affiliateId=${referralId}` (L126)
  - `GET /backend/checkout/call/${callId}` (L142)
  - `POST /backend/checkout/call/${callId}/request-otp` (L170)
  - `POST /backend/checkout/call/${callId}/verify-otp` (L202)
  - `POST /backend/checkout/call/${callId}/process-checkout` (L274)
- **Browser storage / cookies:** `checkout_token` (localStorage: set/get), `checkout_org_id` (localStorage: set/get)
- **Timers / queues:** `setTimeout` at L303, L636

## Dependencies

- **Internal:**
  - `components/ui/button.tsx` — `Button`
  - `components/ui/input.tsx` — `Input`
  - `components/ui/textarea.tsx` — `Textarea`
  - `components/ui/label.tsx` — `Label`
  - `lib/auth.ts` — `saveToken`, `saveOrgId`
  - `lib/api.ts` — `API_URL`
  - `lib/utils.ts` — `cn`
  - `components/checkout/CheckoutPaymentStep.tsx` — `CheckoutPaymentStep`
  - `components/ui/coupon-input.tsx` — `CouponInput`, `AppliedCoupon`
- **Packages:**
  - `react` — `useState`, `useEffect`
  - `next` — `useRouter`
  - `lucide-react` — `Loader2`, `Mail`, `KeyRound`, `User`, `CheckCircle`, `AlertCircle`, …
  - `sonner` — `toast`

## Used by

- `app/checkout/call/[callId]/page.tsx`
