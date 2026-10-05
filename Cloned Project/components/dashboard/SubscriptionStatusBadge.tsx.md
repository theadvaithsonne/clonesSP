# `components/dashboard/SubscriptionStatusBadge.tsx`

> React components `SubscriptionStatusBadge`, `AccessBadge`, `PeriodBadge`.

**Kind:** React component · **Lines:** 195 · **Directive:** `"use client"`

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Composition

**Renders:** `CheckCircle`×3 (lucide-react), `RefreshCw`×3 (lucide-react), `Clock`×2 (lucide-react), `AlertTriangle` (lucide-react), `XCircle` (lucide-react), `Pause` (lucide-react), `AlertCircle` (lucide-react)

### Props

- **`SubscriptionStatusBadge`**: `status: SubscriptionStatus`, `size?: "sm" | "md" | "lg"`, `showIcon?: boolean`, `expiresAt?: string`
- **`AccessBadge`**: `hasAccess: boolean`, `isSubscription?: boolean`, `size?: "sm" | "md" | "lg"`
- **`PeriodBadge`**: `period: "weekly" | "monthly" | "quarterly" | "yearly"`, `size?: "sm" | "md" | "lg"`

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `SubscriptionStatusBadge` | component | `SubscriptionStatusBadge({ status, size = "md", showIcon = true, expiresAt, }: Subsc…)` | 94 |
| `AccessBadge` | component | `AccessBadge({ hasAccess, isSubscription = true, size = "md" }: AccessBa…)` | 140 |
| `PeriodBadge` | component | `PeriodBadge({ period, size = "sm" }: PeriodBadgeProps)` | 181 |

## Interfaces

None detected: no endpoints, events, data access or environment reads were found.

## Dependencies

- **Internal:**
  - `lib/feed-api.ts` — `SubscriptionStatus`
- **Packages:**
  - `lucide-react` — `RefreshCw`, `CheckCircle`, `Clock`, `AlertTriangle`, `XCircle`, `Pause`, …

## Used by

- `components/dashboard/MySubscriptionsPage.tsx`
- `components/dashboard/subscriptions/index.ts`
