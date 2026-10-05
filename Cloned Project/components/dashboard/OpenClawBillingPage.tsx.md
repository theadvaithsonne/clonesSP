# `components/dashboard/OpenClawBillingPage.tsx`

> React component `BillingPage`.

**Kind:** React component · **Lines:** 1163 · **Directive:** `"use client"`

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Composition

**Renders:** `PanelCard`×9 (local), `TabsContent`×6 (components/ui/tabs.tsx), `Button`×5 (components/ui/button.tsx), `SectionHeading`×5 (local), `Loader2`×4 (lucide-react), `Badge`×4 (components/ui/badge.tsx), `AlertCircle`×3 (lucide-react), `Progress`×3 (components/ui/progress.tsx), `Wallet`×2 (lucide-react), `Plus`×2 (lucide-react), `Bot` (lucide-react), `PaymentMethodSelector` (components/checkout/PaymentMethodSelector.tsx), `Info` (lucide-react), `ArrowDownCircle` (lucide-react), `CreditCard` (lucide-react), `Gift` (lucide-react), `Shield` (lucide-react), `StackedAreaChart` (local), `AgentBadge` (local), `Script` (next/script), `Tabs` (components/ui/tabs.tsx), `ScrollArea` (components/ui/scroll-area.tsx), `TabsList` (components/ui/tabs.tsx), `TabsTrigger` (components/ui/tabs.tsx), `OverviewTab` (local), `PaymentMethodsTab` (local), `BillingHistoryTab` (local), `CreditGrantsTab` (local), `PreferencesTab` (local), `UsageTab` (local)

**Hooks used:** `useState`×17, `useEffect`×3, `useCallback`×2, `useRef`

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `default (BillingPage)` | component | `BillingPage()` | 1114 |

## Interfaces

- **Next.js API routes called (same origin):**
  - `GET /api/openclaw/wallet` (L147)
  - `POST /api/openclaw/wallet/verify-payment` (L238)
  - `POST /api/openclaw/wallet/create-order` (L267)
  - `GET /api/billing/transactions?${params}` (L546)
  - `GET /api/billing/usage/agents/summary?${baseQs}` (L963)
  - `GET /api/billing/usage/agents/monthly-chart?${baseQs}` (L964)
- **Timers / queues:** `setTimeout` at L180
- **External hosts mentioned in the code:** `checkout.razorpay.com`

## Dependencies

- **Internal:**
  - `components/ui/tabs.tsx` — `Tabs`, `TabsList`, `TabsTrigger`, `TabsContent`
  - `components/ui/badge.tsx` — `Badge`
  - `components/ui/button.tsx` — `Button`
  - `components/ui/progress.tsx` — `Progress`
  - `components/ui/scroll-area.tsx` — `ScrollArea`
  - `lib/auth.ts` — `getOrgId`, `getToken`, `getUserIdFromToken`
  - `components/checkout/PaymentMethodSelector.tsx` — `PaymentMethodSelector`
- **Packages:**
  - `react` — `useState`, `useEffect`, `useRef`, `useCallback`
  - `framer-motion` — `motion`
  - `next`
  - `sonner` — `toast`
  - `lucide-react` — `DollarSign`, `CreditCard`, `FileText`, `Gift`, `Settings`, `BarChart3`, …

## Used by

- `components/dashboard/AIManagementPage.tsx`
