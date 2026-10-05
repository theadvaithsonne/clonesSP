# `components/garage-admin/WithdrawalPreferencesTab.tsx`

> Vaults → Withdrawals → "Preferences" sub-tab.

**Kind:** React component · **Lines:** 339 · **Directive:** `"use client"`

<!-- docgen:auto -->

## Purpose
Vaults → Withdrawals → "Preferences" sub-tab.

Every standing payout instruction users have set on their wallets (weekly
every Friday, or daily; optional keep-amount on either), with what is due
against it right now — and, on the affiliate wallet, the Garage processing
fee that choice earns them: daily 5% / 2%, weekly 2% / 0%, the lower rate in
each pair being the one where they leave $50+ behind. Store and
content-rewards preferences are free and read "No fee".

Read-only by design: the team reads this and initiates withdrawals from the
Queue tab exactly as before — nothing is automated. Visual vocabulary matches
the queue (same cards, pills, stat tiles) so the two tabs read as one page.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Composition

**Renders:** `StatCard`×5 (local), `Icon` (local), `CalendarClock` (lucide-react), `CalendarDays` (lucide-react), `Percent` (lucide-react), `CheckIcon` (lucide-react), `Copy` (lucide-react), `Search` (lucide-react), `Input` (components/ui/input.tsx), `Users` (lucide-react), `FrequencyPill` (local), `FeePill` (local), `CopyEmail` (local), `PiggyBank` (lucide-react)

### Props

- **`WithdrawalPreferencesTab`**: `headerSearch: string`

**Hooks used:** `useState`×8, `useEffect`×2, `useMemo`

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `WithdrawalPreferencesTab` | component | `WithdrawalPreferencesTab({ headerSearch }: { headerSearch: string })` | 138 |
| `default (WithdrawalPreferencesTab)` | component | `WithdrawalPreferencesTab({ headerSearch }: { headerSearch: string })` | 338 |

## Interfaces

- **Timers / queues:** `setTimeout` at L126, L148

## Dependencies

- **Internal:**
  - `components/ui/input.tsx` — `Input`
  - `lib/admin-api/withdrawals.ts` — `listWithdrawalPreferences`, `WithdrawalPreferenceRow`, `WithdrawalPreferencesResult`
- **Packages:**
  - `react` — `useEffect`, `useMemo`, `useState`
  - `lucide-react` — `Search`, `CalendarDays`, `CalendarClock`, `Wallet`, `PiggyBank`, `Users`, …
  - `sonner` — `toast`

## Used by

- `app/garage-admin/(admin-dashboard)/withdrawals/page.tsx`
