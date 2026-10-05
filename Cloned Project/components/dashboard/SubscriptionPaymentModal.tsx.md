# `components/dashboard/SubscriptionPaymentModal.tsx`

> React component `SubscriptionPaymentModal`.

**Kind:** React component · **Lines:** 526 · **Directive:** `"use client"`

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Composition

**Renders:** `Loader2`×2 (lucide-react), `Button`×2 (components/ui/button.tsx), `RefreshCw`×2 (lucide-react), `Rss` (lucide-react), `BookOpen` (lucide-react), `Video` (lucide-react), `Package` (lucide-react), `X` (lucide-react), `ArrowLeft` (lucide-react), `PaymentMethodSelector` (components/checkout/PaymentMethodSelector.tsx), `CreditCard` (lucide-react), `Calendar` (lucide-react)

### Props

- **`SubscriptionPaymentModal`**: `isOpen: boolean`, `onClose: () => void`, `itemType: SubscriptionItemType`, `item: ItemDetails`, `orgId: string`, `userData: { name: string; email: string; }`, `onSuccess: () => void`

**Hooks used:** `useState`×7, `useEffect`

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `SubscriptionPaymentModal` | component | `SubscriptionPaymentModal({ isOpen, onClose, itemType, item, orgId, userData, onSucce…)` | 91 |

## Interfaces

- **Timers / queues:** `setTimeout` at L200, L295
- **External hosts mentioned in the code:** `checkout.razorpay.com`

## Dependencies

- **Internal:**
  - `components/ui/button.tsx` — `Button`
  - `lib/feed-api.ts` — `subscribeToItem`, `getSubscriptionPlan`, `SubscriptionPlan`, `SubscriptionItemType`, `SubscriptionPeriod`
  - `components/checkout/PaymentMethodSelector.tsx` — `PaymentMethodSelector`
  - `lib/razorpayPrefill.ts` — `getRazorpayContactForCurrentUser`
- **Packages:**
  - `react` — `useState`, `useEffect`
  - `lucide-react` — `X`, `Loader2`, `CreditCard`, `RefreshCw`, `Calendar`, `Package`, …
  - `sonner` — `toast`

## Used by

- `components/dashboard/subscriptions/index.ts`
