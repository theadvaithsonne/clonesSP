# `app/garage-admin/(admin-dashboard)/sweeper/page.tsx`

> Garage Admin → Sweeper tab.

**Kind:** Next.js page · **Lines:** 1510 · **Directive:** `"use client"` · **Route:** `/garage-admin/sweeper` (page)

<!-- docgen:auto -->

## Purpose
Garage Admin → Sweeper tab.

Every settled-but-unswept HD-derived crypto deposit across BSC /
Polygon / Ethereum / Bitcoin / Tron, plus a full history of every
completed sweep. Backed by three endpoints on the crypto backend:
  GET /garage-admin/sweeper/summary   — top-of-page totals
  GET /garage-admin/sweeper/pending   — unswept rows (with USD)
  GET /garage-admin/sweeper/history   — completed sweeps (with USD)
  GET /garage-admin/sweeper/gas-status— per-chain gas-float health
  POST /garage-admin/sweeper/run      — trigger a sweep

Detection is automatic on the backend — this page only exposes the
consolidation step + a verifiable audit trail.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Composition

**Renders:** `ExternalLink`×6 (lucide-react), `Loader2`×5 (lucide-react), `ArrowUpRight`×5 (lucide-react), `CopyButton`×4 (local), `AlertTriangle`×3 (lucide-react), `SummaryCard`×3 (local), `Fuel`×3 (lucide-react), `CheckCircle2`×3 (lucide-react), `RefreshCw`×2 (lucide-react), `Clock`×2 (lucide-react), `ChainPill`×2 (local), `SubTabButton`×2 (local), `HistoryIcon`×2 (lucide-react), `EventTimeline`×2 (local), `CheckIcon` (lucide-react), `Copy` (lucide-react), `SkeletonHeader` (local), `SkeletonSummary` (local), `SkeletonTable` (local), `TrendingUp` (lucide-react), `PendingTable` (local), `HistoryTable` (local), `ChevronDown` (lucide-react), `ChevronRight` (lucide-react), `GasFloatCard` (local), `BatchConfirmDialog` (local)

**Hooks used:** `useState`×15, `useCallback`×2, `useMemo`×2, `useEffect`

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `default (SweeperPage)` | component | `SweeperPage()` | 310 |

## Interfaces

- **Timers / queues:** `setTimeout` at L290
- **External hosts mentioned in the code:** `bscscan.com`, `polygonscan.com`, `etherscan.io`, `mempool.space`, `tronscan.org`

## Dependencies

- **Internal:**
  - `lib/admin-api/sweeper.ts` — `listPendingSweeps`, `listSweepHistory`, `getSweeperGasStatus`, `getSweeperSummary`, `runSweeper`, `recoverSweeperGas`, `SweeperPendingRow`, `SweeperHistoryRow`, … +4
- **Packages:**
  - `react` — `useCallback`, `useEffect`, `useMemo`, `useState`
  - `sonner` — `toast`
  - `lucide-react` — `Loader2`, `RefreshCw`, `ArrowUpRight`, `AlertTriangle`, `CheckCircle2`, `Fuel`, …

## Used by

Entry: reached by the Next.js router at `/garage-admin/sweeper` (page).

## Notes

- Large file (1510 lines) — read it by section; line numbers above point into it.
