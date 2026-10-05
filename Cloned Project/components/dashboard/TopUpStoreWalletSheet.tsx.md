# `components/dashboard/TopUpStoreWalletSheet.tsx`

> React component `TopUpStoreWalletSheet`.

**Kind:** React component · **Lines:** 588 · **Directive:** `"use client"`

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Composition

**Renders:** `Loader2`×2 (lucide-react), `AlertCircle`×2 (lucide-react), `Wallet` (lucide-react), `ArrowLeft` (lucide-react), `X` (lucide-react), `Sparkles` (lucide-react), `Select` (components/ui/select.tsx), `SelectTrigger` (components/ui/select.tsx), `SelectValue` (components/ui/select.tsx), `SelectContent` (components/ui/select.tsx), `SelectItem` (components/ui/select.tsx), `Building2` (lucide-react), `PaymentMethodSelector` (components/checkout/PaymentMethodSelector.tsx)

### Props

- **`TopUpStoreWalletSheet`**: `open: boolean`, `onOpenChange: (open: boolean) => void`, `orgs: TopUpStoreWalletSheetOrg[]`, `defaultOrgId?: string | null`, `onSuccess?: () => void`

**Hooks used:** `useState`×7, `useEffect`×2, `useMemo`×2

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `TopUpStoreWalletSheetOrg` | interface |  | 28 |
| `TopUpStoreWalletSheet` | component | `TopUpStoreWalletSheet({ open, onOpenChange, orgs, defaultOrgId, onSuccess, }: Pro…)` | 111 |

## Interfaces

- **Backend endpoints called (via `/backend`):**
  - `POST /backend/api/invoices/${invoice._id}/verify-payment` (L215)
- **Timers / queues:** `setTimeout` at L93
- **External hosts mentioned in the code:** `checkout.razorpay.com`

## Dependencies

- **Internal:**
  - `components/ui/select.tsx` — `Select`, `SelectContent`, `SelectItem`, `SelectTrigger`, `SelectValue`
  - `lib/utils.ts` — `cn`
  - `lib/feed-api.ts` — `topUpStoreWallet`
  - `components/checkout/PaymentMethodSelector.tsx` — `PaymentMethodSelector`
  - `lib/api.ts` — `API_URL`
  - `lib/brand-color-context.tsx` — `getBrandHex`
- **Packages:**
  - `react` — `useEffect`, `useMemo`, `useState`
  - `lucide-react` — `AlertCircle`, `ArrowLeft`, `Building2`, `Loader2`, `Sparkles`, `Wallet`, …
  - `sonner` — `toast`

## Used by

- `components/dashboard/WalletPageNew.tsx`
- `components/dashboard/jobs/founder/wizard/StepReward.tsx`
