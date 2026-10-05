# `components/dashboard/CustomersPage.tsx`

> React component `CustomersPage`.

**Kind:** React component · **Lines:** 1013 · **Directive:** `"use client"`

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Composition

**Renders:** `Rss`×5 (lucide-react), `Check`×5 (lucide-react), `ChevronDown`×4 (lucide-react), `SortBtn`×4 (local), `Copy`×4 (lucide-react), `Users`×3 (lucide-react), `SlidersHorizontal`×2 (lucide-react), `ChevronUp`×2 (lucide-react), `ChannelBadge`×2 (local), `Mail`×2 (lucide-react), `StatusBadge`×2 (local), `DollarSign` (lucide-react), `TrendingUp` (lucide-react), `Search` (lucide-react), `X` (lucide-react), `UserCheck` (lucide-react), `Clock` (lucide-react), `Columns3` (lucide-react), `LayoutGrid` (lucide-react), `RefreshCcw` (lucide-react), `Loader2` (lucide-react), `TableRow` (local), `GridCard` (local), `ChevronLeft` (lucide-react), `ChevronRight` (lucide-react), `AffiliateCell` (local), `Calendar` (lucide-react)

**Hooks used:** `useState`×15, `useEffect`×3, `useRef`×2

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `CustomersPage` | component | `CustomersPage()` | 51 |

## Interfaces

- **Browser storage / cookies:** `garage_org_id` (localStorage: get)

## Dependencies

- **Internal:**
  - `lib/utils.ts` — `cn`
  - `lib/feed-api.ts` — `getCustomers`, `getOrgChannels`, `getFeedStats`, `Customer`, `Channel`, `FeedStats`
- **Packages:**
  - `react` — `useState`, `useEffect`, `useRef`
  - `lucide-react` — `Users`, `Search`, `RefreshCcw`, `Mail`, `Rss`, `ChevronDown`, …
  - `sonner` — `toast`

## Used by

- `components/dashboard/RevenueNetworkPages.tsx`
