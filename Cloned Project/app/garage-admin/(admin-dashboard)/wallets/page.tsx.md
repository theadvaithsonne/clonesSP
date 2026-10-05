# `app/garage-admin/(admin-dashboard)/wallets/page.tsx`

> Next.js page rendered at `/garage-admin/wallets`.

**Kind:** Next.js page · **Lines:** 257 · **Directive:** `"use client"` · **Route:** `/garage-admin/wallets` (page)

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Composition

**Renders:** `Button`×3 (components/ui/button.tsx), `Link`×2 (next/link), `Building2`×2 (lucide-react), `Wallet` (lucide-react), `ListOrdered` (lucide-react), `BulkCreditDialog` (components/admin/wallets/BulkCreditDialog.tsx), `WalletStatsCards` (components/admin/wallets/StatsCards.tsx), `Search` (lucide-react), `Input` (components/ui/input.tsx), `ArrowUpRight` (lucide-react)

**Hooks used:** `useState`×10, `useEffect`×3, `useAdminSearch` (components/garage-admin/admin-search.tsx), `useMemo`

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `default (WalletsListPage)` | component | `WalletsListPage()` | 37 |

## Interfaces

- **Timers / queues:** `setTimeout` at L54

## Dependencies

- **Internal:**
  - `components/ui/input.tsx` — `Input`
  - `components/ui/button.tsx` — `Button`
  - `components/garage-admin/admin-search.tsx` — `useAdminSearch`
  - `components/admin/wallets/StatsCards.tsx` — `WalletStatsCards`
  - `components/admin/wallets/BulkCreditDialog.tsx` — `BulkCreditDialog`
  - `lib/admin-api/wallets.ts` — `listWallets`, `getWalletStats`, `WalletListItem`, `WalletStats`, `ListFilters`
- **Packages:**
  - `react` — `useEffect`, `useState`, `useMemo`
  - `next`
  - `lucide-react` — `Loader2`, `Search`, `Wallet`, `Building2`, `ArrowUpRight`, `ListOrdered`
  - `sonner` — `toast`

## Used by

Entry: reached by the Next.js router at `/garage-admin/wallets` (page).
