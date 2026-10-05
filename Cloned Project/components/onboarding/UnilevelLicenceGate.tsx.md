# `components/onboarding/UnilevelLicenceGate.tsx`

> Office-creation paywall.

**Kind:** React component · **Lines:** 302 · **Directive:** `"use client"`

<!-- docgen:auto -->

## Purpose
Office-creation paywall.

A Unilevel Plus licence is required to create an office. When the user
doesn't hold one, this drawer covers the onboarding route and sells them
whatever they're currently eligible for, paying INLINE — the buyer never
leaves the page or opens a tab.

The shell deliberately mirrors the webinar paywall at
components/webinar/WebinarPreJoin.tsx ("invoice-payment" state): right-side
slide-in, click-inert backdrop, <CheckoutPaymentStep> rendered directly.
Every checkout surface in the app is meant to look the same, and that one is
the reference.

Pricing is NOT computed here. `resolveOffer` already encodes the rule that an
in-window buyer pays the licence alone (first NetworkChain month included)
while a past-window buyer must take the licence together with a subscription […]

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Composition

**Renders:** `Check`×2 (lucide-react), `Loader2`×2 (lucide-react), `Lock` (lucide-react), `AlertCircle` (lucide-react), `Building2` (lucide-react), `FreeMonthBanner` (components/dashboard/UnilevelPlusOfferPanel.tsx), `BundlePicker` (components/dashboard/UnilevelPlusOfferPanel.tsx), `CheckoutPaymentStep` (components/checkout/CheckoutPaymentStep.tsx)

### Props

- **`UnilevelLicenceGate`**: `userEmail: string`, `userName?: string`, `onUnlocked: () => void`

**Hooks used:** `useState`×7, `useRouter` (next/navigation), `useCallback`, `useEffect`

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `default (UnilevelLicenceGate)` | component | `UnilevelLicenceGate({ userEmail, userName, onUnlocked, }: { userEmail: string; …)` | 42 |

## Interfaces

- **Timers / queues:** `setTimeout` at L132

## Dependencies

- **Internal:**
  - `components/checkout/CheckoutPaymentStep.tsx` — `CheckoutPaymentStep`
  - `components/dashboard/UnilevelPlusOfferPanel.tsx` — `FreeMonthBanner`, `BundlePicker`
  - `lib/webinar/garage-store-plans.ts` — `getUnilevelPlusProduct`, `resolveOffer`, `offerPrice`, `createComboInvoice`, `UnilevelPlusProduct`, `PlanOffer`
- **Packages:**
  - `react` — `useCallback`, `useEffect`, `useState`
  - `next` — `useRouter`
  - `lucide-react` — `Loader2`, `Lock`, `Check`, `AlertCircle`, `Building2`

## Used by

- `app/(onboarding)/layout.tsx`
