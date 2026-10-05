# `app/checkout/course/[courseId]/CourseCheckoutPage.tsx`

> React component `CourseCheckoutPage`.

**Kind:** Next.js app-directory module (colocated) · **Lines:** 921 · **Directive:** `"use client"`

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Composition

**Renders:** `Loader2`×4 (lucide-react), `Button`×3 (components/ui/button.tsx), `Input`×3 (components/ui/input.tsx), `CheckCircle`×2 (lucide-react), `AlertCircle` (lucide-react), `BookOpen` (lucide-react), `Clock` (lucide-react), `Users` (lucide-react), `UserPlus` (lucide-react), `CheckoutPaymentStep` (components/checkout/CheckoutPaymentStep.tsx), `Mail` (lucide-react), `KeyRound` (lucide-react), `User` (lucide-react), `CouponInput` (components/ui/coupon-input.tsx), `ArrowRight` (lucide-react), `Shield` (lucide-react)

### Props

- **`CourseCheckoutPage`**: `courseId: string`

**Hooks used:** `useState`×15, `useEffect`×2, `useRouter` (next/navigation), `useGstQuote` (lib/hooks/useGstQuote.ts)

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `CourseCheckoutPage` | component | `CourseCheckoutPage({ courseId }: { courseId: string })` | 67 |

## Interfaces

- **Backend endpoints called (via `/backend`):**
  - `GET /backend/affiliate/referrer-info?affiliateId=${referralId}` (L115)
  - `GET /backend/checkout/course/${courseId}` (L131)
  - `POST /backend/checkout/course/${courseId}/request-otp` (L159)
  - `POST /backend/checkout/course/${courseId}/verify-otp` (L194)
  - `POST /backend/checkout/course/${courseId}/process-checkout` (L234)
- **Browser storage / cookies:** `checkout_token` (localStorage: set/get), `checkout_org_id` (localStorage: set/get)
- **Timers / queues:** `setTimeout` at L271, L622

## Dependencies

- **Internal:**
  - `lib/sanitizeDescription.ts` — `sanitizeDescription`
  - `components/ui/button.tsx` — `Button`
  - `components/ui/input.tsx` — `Input`
  - `components/ui/coupon-input.tsx` — `CouponInput`, `AppliedCoupon`
  - `lib/auth.ts` — `saveToken`, `saveOrgId`
  - `lib/api.ts` — `API_URL`
  - `lib/hooks/useGstQuote.ts` — `useGstQuote`
  - `components/checkout/CheckoutPaymentStep.tsx` — `CheckoutPaymentStep`
- **Packages:**
  - `react` — `useState`, `useEffect`
  - `next` — `useRouter`
  - `lucide-react` — `Loader2`, `Mail`, `KeyRound`, `User`, `CheckCircle`, `AlertCircle`, …
  - `sonner` — `toast`

## Used by

- `app/checkout/course/[courseId]/page.tsx`

## Notes

- Security-relevant constructs: `dangerouslySetInnerHTML` (L442).
