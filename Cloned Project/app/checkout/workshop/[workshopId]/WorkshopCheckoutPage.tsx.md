# `app/checkout/workshop/[workshopId]/WorkshopCheckoutPage.tsx`

> React component `WorkshopCheckoutPage`.

**Kind:** Next.js app-directory module (colocated) · **Lines:** 1179 · **Directive:** `"use client"`

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Composition

**Renders:** `Loader2`×4 (lucide-react), `Button`×3 (components/ui/button.tsx), `Input`×3 (components/ui/input.tsx), `Video`×2 (lucide-react), `CheckCircle`×2 (lucide-react), `AlertCircle` (lucide-react), `Calendar` (lucide-react), `Clock` (lucide-react), `Repeat` (lucide-react), `Users` (lucide-react), `UserPlus` (lucide-react), `CheckoutPaymentStep` (components/checkout/CheckoutPaymentStep.tsx), `Mail` (lucide-react), `KeyRound` (lucide-react), `User` (lucide-react), `CouponInput` (components/ui/coupon-input.tsx), `ArrowRight` (lucide-react), `Shield` (lucide-react)

### Props

- **`WorkshopCheckoutPage`**: `workshopId: string`

**Hooks used:** `useState`×18, `useEffect`×3, `useRouter` (next/navigation), `useGstQuote` (lib/hooks/useGstQuote.ts)

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `WorkshopCheckoutPage` | component | `WorkshopCheckoutPage({ workshopId }: { workshopId: string })` | 107 |

## Interfaces

- **Backend endpoints called (via `/backend`):**
  - `GET /backend/affiliate/referrer-info?affiliateId=${referralId}` (L206)
  - `GET /backend/checkout/workshop/${workshopId}` (L222)
  - `POST /backend/checkout/workshop/${workshopId}/request-otp` (L250)
  - `POST /backend/checkout/workshop/${workshopId}/verify-otp` (L285)
  - `POST /backend/checkout/workshop/${workshopId}/process-checkout` (L327)
- **Browser storage / cookies:** `checkout_token` (localStorage: set/get), `checkout_org_id` (localStorage: set/get)
- **Timers / queues:** `setTimeout` at L370, L783

## Dependencies

- **Internal:**
  - `components/ui/button.tsx` — `Button`
  - `components/ui/input.tsx` — `Input`
  - `components/ui/coupon-input.tsx` — `CouponInput`, `AppliedCoupon`
  - `components/checkout/CheckoutPaymentStep.tsx` — `CheckoutPaymentStep`
  - `lib/auth.ts` — `saveToken`, `saveOrgId`
  - `lib/api.ts` — `API_URL`
  - `lib/hooks/useGstQuote.ts` — `useGstQuote`
  - `lib/utils.ts` — `formatTime12Hour`
  - `lib/sanitizeDescription.ts` — `sanitizeDescription`
- **Packages:**
  - `react` — `useState`, `useEffect`
  - `next` — `useRouter`
  - `lucide-react` — `Loader2`, `Mail`, `KeyRound`, `User`, `CheckCircle`, `AlertCircle`, …
  - `sonner` — `toast`

## Used by

- `app/checkout/workshop/[workshopId]/page.tsx`

## Notes

- Security-relevant constructs: `dangerouslySetInnerHTML` (L599).
