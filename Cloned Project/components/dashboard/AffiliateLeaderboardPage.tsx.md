# `components/dashboard/AffiliateLeaderboardPage.tsx`

> React component `AffiliateLeaderboardPage`.

**Kind:** React component · **Lines:** 2291 · **Directive:** `"use client"`

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Composition

**Renders:** `StatCard`×6 (local), `Loader2`×4 (lucide-react), `Icon`×3 (local), `AlertCircle`×3 (lucide-react), `PodiumCard`×3 (local), `Trophy`×2 (lucide-react), `ChevronDown`×2 (lucide-react), `Users`×2 (lucide-react), `Building2`×2 (lucide-react), `Award` (lucide-react), `Earth` (lucide-react), `Dropdown` (local), `Filter` (lucide-react), `ToggleRight` (lucide-react), `ToggleLeft` (lucide-react), `Download` (lucide-react), `Search` (lucide-react), `TableRow` (local), `AchievementCard` (local), `AffiliateDetailsDrawer` (local), `X` (lucide-react), `Clock` (lucide-react), `Package` (lucide-react)

**Hooks used:** `useState`×40, `useEffect`×7, `useMemo`×5, `useCallback`×2, `useRef`

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `AffiliateLeaderboardPage` | component | `AffiliateLeaderboardPage()` | 624 |

## Interfaces

- **Other fetch/api calls (target not statically resolvable):**
  - `GET ${apiUrl}/affiliate/my-affiliate-id` (L702)
- **Environment variables (`process.env`):** `NEXT_PUBLIC_API_URL`
- **Browser storage / cookies:** `garage_org_id` (localStorage: get)
- **Timers / queues:** `setTimeout` at L1839

## Dependencies

- **Internal:**
  - `lib/auth.ts` — `getToken`
  - `lib/revenue-network-cache.ts` — `getRevenueNetworkData`
  - `lib/affiliate-analytics-api.ts` — `fetchAllDirectReferrals`, `fetchAllIndirectReferrals`, `fetchLeaderboardPage`, `fetchAllLeaderboard`, `fetchCategories`, `fetchAffiliateDetails`, `DirectReferralItem`, `IndirectReferralItem`, … +7
- **Packages:**
  - `react` — `useState`, `useEffect`, `useMemo`, `useCallback`, `useRef`
  - `react-dom` — `createPortal`
  - `lucide-react` — `Trophy`, `DollarSign`, `Users`, `TrendingUp`, `Zap`, `Globe`, …

## Used by

- `components/dashboard/RevenueNetworkPages.tsx`

## Notes

- Large file (2291 lines) — read it by section; line numbers above point into it.
