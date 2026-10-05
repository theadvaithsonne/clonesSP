# `app/garage-admin/(admin-dashboard)/withdrawals/page.tsx`

> Next.js page rendered at `/garage-admin/withdrawals`.

**Kind:** Next.js page · **Lines:** 630 · **Directive:** `"use client"` · **Route:** `/garage-admin/withdrawals` (page)

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Composition

**Renders:** `StatCard`×4 (local), `Button`×4 (components/ui/button.tsx), `Input`×3 (components/ui/input.tsx), `Icon`×2 (local), `ArrowUpRight`×2 (lucide-react), `FileText`×2 (lucide-react), `Loader2`×2 (lucide-react), `WithdrawalPreferencesTab` (components/garage-admin/WithdrawalPreferencesTab.tsx), `Search` (lucide-react), `StatusPill` (local), `Landmark` (lucide-react), `Coins` (lucide-react), `ActionDialog` (local), `Dialog` (components/ui/dialog.tsx), `DialogContent` (components/ui/dialog.tsx), `DialogHeader` (components/ui/dialog.tsx), `CheckCircle2` (lucide-react), `XCircle` (lucide-react), `DialogTitle` (components/ui/dialog.tsx), `X` (lucide-react), `Upload` (lucide-react), `DialogFooter` (components/ui/dialog.tsx)

**Hooks used:** `useState`×16, `useEffect`×3, `useAdminSearch` (components/garage-admin/admin-search.tsx), `useMemo`, `useRef`

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `default (WithdrawalsQueuePage)` | component | `WithdrawalsQueuePage()` | 107 |

## Interfaces

- **Backend endpoints called (via `/backend`):**
  - `POST /backend/garage-admin/upload` (L373)
- **Browser storage / cookies:** `garage_admin_token` (localStorage: get)
- **Timers / queues:** `setTimeout` at L124, L134
- **External hosts mentioned in the code:** `etherscan.io`, `bscscan.com`, `polygonscan.com`, `tronscan.org`, `mempool.space`, `solscan.io`

## Dependencies

- **Internal:**
  - `components/ui/input.tsx` — `Input`
  - `components/ui/button.tsx` — `Button`
  - `components/ui/dialog.tsx` — `Dialog`, `DialogContent`, `DialogHeader`, `DialogTitle`, `DialogFooter`
  - `lib/api.ts` — `API_URL`
  - `components/garage-admin/admin-search.tsx` — `useAdminSearch`
  - `components/garage-admin/WithdrawalPreferencesTab.tsx` — `WithdrawalPreferencesTab`
  - `lib/admin-api/withdrawals.ts` — `listWithdrawals`, `getWithdrawalStats`, `completeWithdrawal`, `rejectWithdrawal`, `AdminWithdrawal`, `WithdrawalStats`
- **Packages:**
  - `react` — `useEffect`, `useState`, `useMemo`, `useRef`
  - `lucide-react` — `Search`, `ArrowUpRight`, `Landmark`, `Coins`, `Loader2`, `Clock`, …
  - `sonner` — `toast`

## Used by

Entry: reached by the Next.js router at `/garage-admin/withdrawals` (page).
