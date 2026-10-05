# `components/dashboard/RewardsTab.tsx`

> React component `RewardsTab`.

**Kind:** React component · **Lines:** 629 · **Directive:** `"use client"`

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Composition

**Renders:** `Loader2`×3 (lucide-react), `Sparkles`×2 (lucide-react), `AnimatePresence`×2 (framer-motion), `Copy`×2 (lucide-react), `UserIcon` (lucide-react), `Building2` (lucide-react), `Shield` (lucide-react), `XCircle` (lucide-react), `CheckCircle2` (lucide-react), `Wallet` (lucide-react), `IncomingOfferCard` (local), `TicketPercent` (lucide-react), `AssignerPill` (local), `Check` (lucide-react), `Clock` (lucide-react), `AlertCircle` (lucide-react), `Gift` (lucide-react), `GiftRewardModal` (components/dashboard/GiftRewardModal.tsx)

**Hooks used:** `useState`×8, `useCallback`, `useEffect`, `useMemo`

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `RewardsTab` | component | `RewardsTab()` | 272 |

## Interfaces

- **Backend endpoints called (via `/backend`):**
  - `GET /backend/me/rewards${qs}` (L288)
- **Timers / queues:** `setTimeout` at L331

## Dependencies

- **Internal:**
  - `lib/utils.ts` — `cn`
  - `lib/api.ts` — `API_URL`
  - `lib/auth.ts` — `getToken`
  - `components/dashboard/GiftRewardModal.tsx` — `GiftRewardModal`
  - `lib/rewards-api.ts` — `PendingCouponOffer`, `approveCouponOffer`, `cancelCouponOffer`, `listIncomingOffers`, `listOutgoingOffers`, `rejectCouponOffer`
- **Packages:**
  - `react` — `useState`, `useEffect`, `useCallback`, `useMemo`
  - `lucide-react` — `TicketPercent`, `Loader2`, `Copy`, `Check`, `Gift`, `Building2`, …
  - `sonner` — `toast`
  - `framer-motion` — `AnimatePresence`, `motion`

## Used by

- `components/dashboard/WalletPageNew.tsx`
