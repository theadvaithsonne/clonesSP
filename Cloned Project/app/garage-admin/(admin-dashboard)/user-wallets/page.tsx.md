# `app/garage-admin/(admin-dashboard)/user-wallets/page.tsx`

> User Wallets — global bird's-eye list across every user × every wallet.

**Kind:** Next.js page · **Lines:** 681 · **Directive:** `"use client"` · **Route:** `/garage-admin/user-wallets` (page)

<!-- docgen:auto -->

## Purpose
User Wallets — global bird's-eye list across every user × every wallet.

Powers the use case: "show me every wallet, search by name/email, sort by
biggest balance, withdraw without drilling into each user one-by-one."

Each row reuses the same `InitiateWithdrawalDialog` the per-user detail page
opens, so the withdrawal contract (fee + taxes + payout account) stays
single-sourced. On Withdraw click we fetch the canonical per-user wallets
via `getUserWallets()` and pass the matching wallet to the dialog so it
receives the freshest `withdrawableBalance` + populated `accounts` array.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Composition

**Renders:** `Loader2`×3 (lucide-react), `Link`×3 (next/link), `Icon`×2 (local), `Button`×2 (components/ui/button.tsx), `ArrowUpRight`×2 (lucide-react), `Wallet` (lucide-react), `Search` (lucide-react), `Input` (components/ui/input.tsx), `DollarSign` (lucide-react), `SearchableSelectField` (components/ui/searchable-select.tsx), `Globe` (lucide-react), `Landmark` (lucide-react), `Sparkles` (lucide-react), `WalletListRow` (local), `InitiateWithdrawalDialog` (components/admin/InitiateWithdrawalDialog.tsx), `Building2` (lucide-react), `ChevronRight` (lucide-react)

**Hooks used:** `useState`×17, `useEffect`×4, `useMemo`×2, `useAdminSearch` (components/garage-admin/admin-search.tsx)

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `default (UserWalletsPage)` | component | `UserWalletsPage()` | 122 |

## Interfaces

- **Timers / queues:** `setTimeout` at L153, L162

## Dependencies

- **Internal:**
  - `components/ui/input.tsx` — `Input`
  - `components/ui/button.tsx` — `Button`
  - `components/ui/searchable-select.tsx` — `SearchableSelectField`
  - `lib/country-flag.ts` — `getCountryFlag`
  - `lib/admin-api/user-wallets.ts` — `listAllUserWallets`, `UserWalletRow`, `UserWalletType`, `UserWalletsListFilters`, `UserWalletCountry`
  - `lib/admin-api/users.ts` — `getUserWallets`, `AdminUserWallet`
  - `components/garage-admin/admin-search.tsx` — `useAdminSearch`
  - `components/admin/InitiateWithdrawalDialog.tsx` — `InitiateWithdrawalDialog`
- **Packages:**
  - `react` — `useEffect`, `useMemo`, `useState`
  - `next`
  - `lucide-react` — `Loader2`, `Search`, `Wallet`, `Building2`, `Sparkles`, `Gift`, …
  - `sonner` — `toast`

## Used by

Entry: reached by the Next.js router at `/garage-admin/user-wallets` (page).
