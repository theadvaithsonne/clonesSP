# `components/dashboard/SubscriptionManagementModal.tsx`

> React component `SubscriptionManagementModal`.

**Kind:** React component · **Lines:** 473 · **Directive:** `"use client"`

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Composition

**Renders:** `Button`×7 (components/ui/button.tsx), `Loader2`×3 (lucide-react), `XCircle`×2 (lucide-react), `RefreshCw`×2 (lucide-react), `Clock`×2 (lucide-react), `Calendar`×2 (lucide-react), `Rss` (lucide-react), `BookOpen` (lucide-react), `Video` (lucide-react), `Package` (lucide-react), `CheckCircle` (lucide-react), `X` (lucide-react), `CreditCard` (lucide-react), `ChevronUp` (lucide-react), `ChevronDown` (lucide-react), `AlertTriangle` (lucide-react), `Play` (lucide-react), `Pause` (lucide-react)

### Props

- **`SubscriptionManagementModal`**: `isOpen: boolean`, `onClose: () => void`, `subscriptionId: string`, `orgId: string`, `onUpdate?: () => void`

**Hooks used:** `useState`×7, `useEffect`

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `SubscriptionManagementModal` | component | `SubscriptionManagementModal({ isOpen, onClose, subscriptionId, orgId, onUpdate, }: Subs…)` | 73 |

## Interfaces

None detected: no endpoints, events, data access or environment reads were found.

## Dependencies

- **Internal:**
  - `components/ui/button.tsx` — `Button`
  - `lib/feed-api.ts` — `getSubscription`, `cancelSubscription`, `pauseSubscription`, `resumeSubscription`, `getSubscriptionPayments`, `Subscription`, `SubscriptionPayment`, `SubscriptionItemType`, … +2
- **Packages:**
  - `react` — `useState`, `useEffect`
  - `lucide-react` — `X`, `Loader2`, `Calendar`, `CreditCard`, `Pause`, `Play`, …
  - `sonner` — `toast`

## Used by

- `components/dashboard/MySubscriptionsPage.tsx`
- `components/dashboard/subscriptions/index.ts`
