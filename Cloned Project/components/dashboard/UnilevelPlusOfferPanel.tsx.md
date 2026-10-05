# `components/dashboard/UnilevelPlusOfferPanel.tsx`

> The window-aware half of the Unilevel Plus card.

**Kind:** React component · **Lines:** 268 · **Directive:** `"use client"`

<!-- docgen:auto -->

## Purpose
The window-aware half of the Unilevel Plus card.

Buying the $25 licence inside a 24-hour window (24h from the buyer's
profileCompletedAt) includes the first NetworkChains month free. Past that
window NetworkChains has to be paid for — monthly, or by prepaying a term.

The in-app card used to know none of this: it posted {quantity} to
/unilevel-plus/checkout/create-order and never mentioned the offer, so
in-window buyers missed a free month they qualified for and expired buyers
got no route to NetworkChains at all.

All pricing is server-supplied. `GET /unilevel-plus/product` already returns
`comboTerms` priced for THIS buyer's window state — closed gives the
standalone list (which includes the 1-month row), open gives the bundle list
(which omits it, because month one is free). This component never does
pricing arithmetic; it renders what the backend sends. […]

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Composition

**Renders:** `Clock` (lucide-react), `Sparkles` (lucide-react), `Countdown` (local), `Check` (lucide-react), `Loader2` (lucide-react), `Zap` (lucide-react)

### Props

- **`FreeMonthBanner`**: `clientName: string`, `secondsRemaining: number`, `onExpire?: () => void`
- **`BundlePicker`**: `group: ComboGroup`, `licenceUsd: number`, `selectedTermMonths: number`, `onSelect: (termMonths: number) => void`, `onBuy: () => void`, `busy?: boolean`

**Hooks used:** `useEffect`×2, `useState`

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `formatRemaining` | function | `formatRemaining(seconds: number): string` — "7h 04m 12s" — ticked locally so the card doesn't re-poll every second. | 34 |
| `FreeMonthBanner` | component | `FreeMonthBanner({ clientName, secondsRemaining, onExpire, }: { clientName: …)` — IN-WINDOW banner. The buyer still qualifies, so the action stays a single $25 purchase — this just makes the offer visible, which is the whole reason people were missing it. | 99 |
| `BundlePicker` | component | `BundlePicker({ group, licenceUsd, selectedTermMonths, onSelect, onBuy, b…)` — PAST-WINDOW picker. The free month is gone, so the buyer chooses how much NetworkChains to prepay alongside the licence. | 138 |

## Interfaces

- **Timers / queues:** `setInterval` at L70

## Dependencies

- **Internal:**
  - `lib/feed-api.ts` — `UnilevelPlusProduct`, `(types only)`
- **Packages:**
  - `react` — `useEffect`, `useState`
  - `lucide-react` — `Check`, `Clock`, `Sparkles`, `Zap`, `Loader2`

## Used by

- `components/dashboard/WalletPageNew.tsx`
- `components/onboarding/UnilevelLicenceGate.tsx`
