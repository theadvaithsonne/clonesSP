# `components/dashboard/DepositCryptoSheet.tsx`

> Deposit Crypto sheet — persistent per-user address flow.

**Kind:** React component · **Lines:** 584 · **Directive:** `"use client"`

<!-- docgen:auto -->

## Purpose
Deposit Crypto sheet — persistent per-user address flow.

Distinct from `TopUpStoreWalletSheet` (which mints a Razorpay/Stripe
invoice for USD-priced top-ups). This sheet is for a cryptobrand-
office member's BTC / ETH / USDT wallet: renders their long-lived
HD-derived deposit address as a QR + copyable string, and polls
`/wallet/store/topup-transactions` every 10s while open so a landed
deposit shows up without a manual refresh.

Zero writes on this side — the backend watchers on `crypto.garage.app`
detect the incoming tx, credit the user's native-currency StoreWallet,
and write a CryptoTopupTransaction row. This sheet just displays.

Design brief locked with Shorupan (2026-09-18):
  - Right-side slide-in, matches TopUpStoreWalletSheet visual
  - No new npm deps — QR uses the existing api.qrserver.com image URL, […]

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Composition

**Renders:** `CheckIcon`×2 (lucide-react), `AlertTriangle`×2 (lucide-react), `RefreshCw`×2 (lucide-react), `ExternalLink`×2 (lucide-react), `Wallet` (lucide-react), `X` (lucide-react), `Loader2` (lucide-react), `Copy` (lucide-react), `CheckCircle2` (lucide-react)

### Props

- **`DepositCryptoSheet`**: `open: boolean`, `onOpenChange: (open: boolean) => void`, `wallet: DepositCryptoSheetWallet | null`, `onDeposit?: (tx: CryptoTopupTransaction) => void`

**Hooks used:** `useState`×8, `useEffect`×3, `useCallback`×3, `useRef`×2

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `DepositCryptoSheetWallet` | interface |  | 54 |
| `DepositCryptoSheet` | component | `DepositCryptoSheet({ open, onOpenChange, wallet, onDeposit, }: Props)` | 142 |

## Interfaces

- **Timers / queues:** `setInterval` at L252; `setTimeout` at L269
- **External hosts mentioned in the code:** `mempool.space`, `etherscan.io`, `polygonscan.com`, `bscscan.com`, `tronscan.org`, `api.qrserver.com`

## Dependencies

- **Internal:**
  - `lib/utils.ts` — `cn`
  - `lib/feed-api.ts` — `getCryptoTopupAddress`, `listCryptoTopupTransactions`, `CryptoTopupAddress`, `CryptoTopupTransaction`, `CryptoTopupChain`
- **Packages:**
  - `react` — `useCallback`, `useEffect`, `useMemo`, `useRef`, `useState`
  - `sonner` — `toast`
  - `lucide-react` — `Check as CheckIcon`, `Copy`, `Loader2`, `ArrowUpRight`, `X`, `AlertTriangle`, …

## Used by

- `components/dashboard/WalletPageNew.tsx`
