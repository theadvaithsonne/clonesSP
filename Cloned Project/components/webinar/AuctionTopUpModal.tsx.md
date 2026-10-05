# `components/webinar/AuctionTopUpModal.tsx`

> React component `AuctionTopUpModal`.

**Kind:** React component · **Lines:** 147 · **Directive:** `"use client"`

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Composition

**Renders:** `Wallet` (lucide-react), `X` (lucide-react), `Loader2` (lucide-react)

### Props

- **`AuctionTopUpModal`**: `shortfallUsd: number`, `onClose: () => void`

**Hooks used:** `useState`×2

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `default (AuctionTopUpModal)` | component | `AuctionTopUpModal({ shortfallUsd, onClose, }: { shortfallUsd: number; onClose…)` — Auction Wallet top-up sheet — opened by the live auction card when a bid comes back 402 INSUFFICIENT_AUCTION_BALANCE. | 24 |

## Interfaces

- **Environment variables (`process.env`):** `NEXT_PUBLIC_APP_URL`

## Dependencies

- **Internal:**
  - `lib/api/auctionWallet.ts` — `topupAuctionWallet`
- **Packages:**
  - `react` — `useState`
  - `react-dom` — `createPortal`
  - `sonner` — `toast`
  - `lucide-react` — `Loader2`, `Wallet`, `X`

## Used by

- `components/webinar/LiveAuctionCard.tsx`
