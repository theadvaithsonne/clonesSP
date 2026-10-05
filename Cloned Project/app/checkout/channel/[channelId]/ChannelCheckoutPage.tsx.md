# `app/checkout/channel/[channelId]/ChannelCheckoutPage.tsx`

> React component `ChannelCheckoutPage`.

**Kind:** Next.js app-directory module (colocated) · **Lines:** 953 · **Directive:** `"use client"`

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Composition

**Renders:** `Button`×5 (components/ui/button.tsx), `Loader2`×4 (lucide-react), `Input`×3 (components/ui/input.tsx), `Hash`×2 (lucide-react), `CheckCircle`×2 (lucide-react), `AlertCircle` (lucide-react), `UserPlus` (lucide-react), `CheckoutPaymentStep` (components/checkout/CheckoutPaymentStep.tsx), `Mail` (lucide-react), `KeyRound` (lucide-react), `User` (lucide-react), `CouponInput` (components/ui/coupon-input.tsx), `ArrowRight` (lucide-react), `Shield` (lucide-react)

### Props

- **`ChannelCheckoutPage`**: `channelId: string`

**Hooks used:** `useState`×15, `useEffect`×2, `useRouter` (next/navigation), `useGstQuote` (lib/hooks/useGstQuote.ts)

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `ChannelCheckoutPage` | component | `ChannelCheckoutPage({ channelId }: { channelId: string })` | 65 |

## Interfaces

- **Backend endpoints called (via `/backend`):**
  - `GET /backend/affiliate/referrer-info?affiliateId=${referralId}` (L113)
  - `GET /backend/checkout/channel/${channelId}` (L129)
  - `POST /backend/checkout/channel/${channelId}/request-otp` (L157)
  - `POST /backend/checkout/channel/${channelId}/verify-otp` (L192)
  - `POST /backend/checkout/channel/${channelId}/process-checkout` (L232)
- **Browser storage / cookies:** `checkout_token` (localStorage: set/get), `checkout_org_id` (localStorage: set/get)
- **Timers / queues:** `setTimeout` at L269, L615

## Dependencies

- **Internal:**
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

- `app/checkout/channel/[channelId]/page.tsx`

## Notes

- Security-relevant constructs: `dangerouslySetInnerHTML` (L431).
