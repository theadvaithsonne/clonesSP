# `components/dashboard/WithdrawalPreferenceSection.tsx`

> Withdrawal preference — one card per wallet tab, beside the payout accounts.

**Kind:** React component · **Lines:** 517 · **Directive:** `"use client"`

<!-- docgen:auto -->

## Purpose
Withdrawal preference — one card per wallet tab, beside the payout accounts.

The user says how often they want this wallet paid out (weekly, every
Friday — the default — or daily) and how much to leave in the wallet each
time. It is a standing instruction: nothing is automated, the payouts team
reads it (Admin → Vaults → Withdrawals → Preferences) and pays out from
there. Same visual vocabulary as PayoutAccountsSection so the two read as
one settings block.

On the AFFILIATE wallet the choice is also priced, so the card shows what
each combination costs and what the current one earns:

                    withdraw everything      keep $50 in
    daily                   5%                    2%
    weekly                  2%                    0%
 […]

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Composition

**Renders:** `Icon`×2 (local), `Check`×2 (lucide-react), `PiggyBank`×2 (lucide-react), `CalendarClock` (lucide-react), `Info` (lucide-react), `Input` (components/ui/input.tsx), `ArrowRight` (lucide-react), `Button` (components/ui/button.tsx), `Loader2` (lucide-react)

### Props

- **`WithdrawalPreferenceSection`**: `walletType: WalletAccountWalletType`, `orgId?: string | null`

**Hooks used:** `useState`×7, `useMemo`×3, `useCallback`, `useEffect`

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `WithdrawalPreferenceSection` | component | `WithdrawalPreferenceSection({ walletType, orgId, }: { walletType: WalletAccountWalletTy…)` | 98 |
| `default (WithdrawalPreferenceSection)` | component | `WithdrawalPreferenceSection({ walletType, orgId, }: { walletType: WalletAccountWalletTy…)` | 516 |

## Interfaces

None detected: no endpoints, events, data access or environment reads were found.

## Dependencies

- **Internal:**
  - `components/ui/button.tsx` — `Button`
  - `components/ui/input.tsx` — `Input`
  - `lib/feed-api.ts` — `getWithdrawalFees`, `getWithdrawalPreference`, `saveWithdrawalPreference`, `AffiliateFeeMatrixCell`, `WalletAccountWalletType`, `WithdrawalFeesResponse`, `WithdrawalFrequency`, `WithdrawalPreferenceData`
- **Packages:**
  - `react` — `useCallback`, `useEffect`, `useMemo`, `useState`
  - `lucide-react` — `ArrowRight`, `Banknote`, `CalendarClock`, `CalendarDays`, `Check`, `Coins`, …
  - `sonner` — `toast`

## Used by

- `components/dashboard/WalletPageNew.tsx`
