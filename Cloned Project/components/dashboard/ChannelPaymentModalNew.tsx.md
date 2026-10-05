# `components/dashboard/ChannelPaymentModalNew.tsx`

> React component `ChannelPaymentModalNew`.

**Kind:** React component · **Lines:** 858 · **Directive:** `"use client"`

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Composition

**Renders:** `Loader2`×3 (lucide-react), `Button`×3 (components/ui/button.tsx), `Tag`×2 (lucide-react), `Rss` (lucide-react), `ArrowLeft` (lucide-react), `X` (lucide-react), `RefreshCw` (lucide-react), `ExternalLink` (lucide-react), `PlatformCouponInput` (components/ui/platform-coupon-input.tsx), `PaymentMethodSelector` (components/checkout/PaymentMethodSelector.tsx), `Sparkles` (lucide-react), `CheckCircle2` (lucide-react), `CreditCard` (lucide-react), `ShieldCheck` (lucide-react)

### Props

- **`ChannelPaymentModalNew`**: `isOpen: boolean`, `onClose: () => void`, `channel: Channel`, `orgId: string`, `userData: { name: string; email: string; }`, `onSuccess: () => void`

**Hooks used:** `useState`×11, `useEffect`×3, `useGstQuote` (lib/hooks/useGstQuote.ts), `useCallback`

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `ChannelPaymentModalNew` | component | `ChannelPaymentModalNew({ isOpen, onClose, channel, orgId, userData, onSuccess, }: …)` | 75 |

## Interfaces

- **Backend endpoints called (via `/backend`):**
  - `POST /backend/api/invoices/${invoiceId}/apply-platform-coupon` (L707)
- **Environment variables (`process.env`):** `NEXT_PUBLIC_RAZORPAY_KEY_ID`
- **Timers / queues:** `setTimeout` at L207
- **External hosts mentioned in the code:** `checkout.razorpay.com`

## Dependencies

- **Internal:**
  - `lib/utils.ts` — `cn`
  - `components/ui/button.tsx` — `Button`
  - `lib/feed-api.ts` — `createChannelOrder`, `verifyChannelPayment`, `getChannelSubscriptionStatus`, `Channel`
  - `components/checkout/PaymentMethodSelector.tsx` — `PaymentMethodSelector`
  - `components/ui/platform-coupon-input.tsx` — `PlatformCouponInput`
  - `lib/auth.ts` — `getToken`
  - `lib/api.ts` — `API_URL`
  - `lib/hooks/useGstQuote.ts` — `useGstQuote`
  - `lib/razorpayPrefill.ts` — `getRazorpayContactForCurrentUser`
  - `lib/sanitizeDescription.ts` — `sanitizeDescription`
  - `lib/brand-color-context.tsx` — `getBrandHex`
- **Packages:**
  - `react` — `useState`, `useEffect`, `useCallback`
  - `lucide-react` — `X`, `Loader2`, `CreditCard`, `Rss`, `RefreshCw`, `ExternalLink`, …
  - `sonner` — `toast`

## Used by

- `components/dashboard/ChannelsPage.tsx`
- `components/dashboard/FeedPageRedesigned.tsx`

## Notes

- Security-relevant constructs: `dangerouslySetInnerHTML` (L601).
