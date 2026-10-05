# `components/webinar/LiveAuctionCard.tsx`

> React component `LiveAuctionCard`.

**Kind:** React component · **Lines:** 478 · **Directive:** `"use client"`

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Composition

**Renders:** `Gavel`×3 (lucide-react), `Timer`×2 (lucide-react), `Trophy`×2 (lucide-react), `Loader2`×2 (lucide-react), `Minus` (lucide-react), `X` (lucide-react), `TrendingUp` (lucide-react), `Package` (lucide-react), `ChevronsRight` (lucide-react), `Wallet` (lucide-react), `Hourglass` (lucide-react), `AuctionTopUpModal` (components/webinar/AuctionTopUpModal.tsx)

### Props

- **`LiveAuctionCard`**: `auction: AuctionLot`, `fallbackName?: string`, `fallbackImage?: string`, `authed: boolean`, `meId?: string | null`, `bidding: boolean`, `win: AuctionWin | null`, `wallet: AuctionWalletBalance | null`, `onBid: (amount: number) => void`, `shortfallUsd: number | null`, `onShortfallClear: () => void`, `isHost: boolean`, `onCancelAuction?: () => void`, `cancelling?: boolean`, `onUnpin?: () => void`

**Hooks used:** `useState`×4, `useEffect`×2, `useRef`×2, `useRouter` (next/navigation)

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `default (LiveAuctionCard)` | component | `LiveAuctionCard({ auction, fallbackName, fallbackImage, authed, meId, biddi…)` — The live lot overlay inside a webinar room. | 42 |

## Interfaces

- **Timers / queues:** `setInterval` at L87; `setTimeout` at L115

## Dependencies

- **Internal:**
  - `lib/api/auctionLot.ts` — `nextBidAmount`, `AuctionLot`, `AuctionWin`
  - `lib/api/auctionWallet.ts` — `AuctionWalletBalance`, `(types only)`
  - `lib/webinar/currency.ts` — `formatMoney`
  - `components/webinar/AuctionTopUpModal.tsx` — `AuctionTopUpModal (default)`
- **Packages:**
  - `react` — `useEffect`, `useRef`, `useState`
  - `next` — `useRouter`
  - `lucide-react` — `ChevronsRight`, `Gavel`, `Hourglass`, `Loader2`, `Minus`, `Package`, …

## Used by

- `app/webinar/[id]/WebinarRoomClient.tsx`
