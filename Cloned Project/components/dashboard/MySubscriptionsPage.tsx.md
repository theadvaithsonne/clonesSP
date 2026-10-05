# `components/dashboard/MySubscriptionsPage.tsx`

> React component `MySubscriptionsPage`.

**Kind:** React component · **Lines:** 335 · **Directive:** `"use client"`

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Composition

**Renders:** `Button`×4 (components/ui/button.tsx), `RefreshCw`×2 (lucide-react), `Rss` (lucide-react), `BookOpen` (lucide-react), `Video` (lucide-react), `Package` (lucide-react), `Loader2` (lucide-react), `AlertCircle` (lucide-react), `SubscriptionStatusBadge` (components/dashboard/SubscriptionStatusBadge.tsx), `CreditCard` (lucide-react), `PeriodBadge` (components/dashboard/SubscriptionStatusBadge.tsx), `Calendar` (lucide-react), `Settings` (lucide-react), `ChevronRight` (lucide-react), `SubscriptionManagementModal` (components/dashboard/SubscriptionManagementModal.tsx)

### Props

- **`MySubscriptionsPage`**: `orgId: string`

**Hooks used:** `useState`×8, `useEffect`

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `MySubscriptionsPage` | component | `MySubscriptionsPage({ orgId }: MySubscriptionsPageProps)` | 49 |

## Interfaces

None detected: no endpoints, events, data access or environment reads were found.

## Dependencies

- **Internal:**
  - `components/ui/button.tsx` — `Button`
  - `lib/feed-api.ts` — `getMySubscriptions`, `Subscription`, `SubscriptionItemType`, `SubscriptionStatus`, `SubscriptionPlan`
  - `components/dashboard/SubscriptionStatusBadge.tsx` — `SubscriptionStatusBadge`, `PeriodBadge`
  - `components/dashboard/SubscriptionManagementModal.tsx` — `SubscriptionManagementModal`
- **Packages:**
  - `react` — `useState`, `useEffect`
  - `lucide-react` — `Loader2`, `RefreshCw`, `Package`, `BookOpen`, `Video`, `Rss`, …
  - `sonner` — `toast`

## Used by

- `components/dashboard/subscriptions/index.ts`
