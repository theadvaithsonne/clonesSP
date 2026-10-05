# `components/dashboard/GiftRewardModal.tsx`

> React component `GiftRewardModal`.

**Kind:** React component · **Lines:** 598 · **Directive:** `"use client"`

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Composition

**Renders:** `AnimatePresence`×4 (framer-motion), `Loader2`×3 (lucide-react), `Gift`×2 (lucide-react), `DollarSign`×2 (lucide-react), `Check`×2 (lucide-react), `X` (lucide-react), `Search` (lucide-react), `Wallet` (lucide-react), `Sparkles` (lucide-react)

### Props

- **`GiftRewardModal`**: `open: boolean`, `onClose: () => void`, `assignmentId: string`, `couponCode: string`, `couponName?: string`, `onGifted: () => void`

**Hooks used:** `useState`×12, `useEffect`×3, `useRef`×2

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `GiftRewardModal` | component | `GiftRewardModal({ open, onClose, assignmentId, couponCode, couponName, onGi…)` | 42 |

## Interfaces

- **Backend endpoints called (via `/backend`):**
  - `GET /backend/users/discover?search=${encodeURIComponent(trimmed)}&limit=20` (L98)
- **Timers / queues:** `setTimeout` at L94, L141

## Dependencies

- **Internal:**
  - `lib/api.ts` — `API_URL`
  - `lib/auth.ts` — `getToken`, `getOrgId`
  - `lib/rewards-api.ts` — `EligibilityCandidate`, `createPaidCouponOffer`, `giftReward`, `searchRecipientEligibility`
  - `lib/utils.ts` — `cn`
- **Packages:**
  - `react` — `useState`, `useEffect`, `useRef`
  - `lucide-react` — `Loader2`, `Gift`, `X`, `Check`, `DollarSign`, `Wallet`, …
  - `framer-motion` — `AnimatePresence`, `motion`
  - `sonner` — `toast`

## Used by

- `components/dashboard/RewardsTab.tsx`
