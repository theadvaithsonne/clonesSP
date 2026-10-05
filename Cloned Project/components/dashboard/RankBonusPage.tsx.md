# `components/dashboard/RankBonusPage.tsx`

> Member-facing view of the NetworkChain rank bonus.

**Kind:** React component · **Lines:** 674 · **Directive:** `"use client"`

<!-- docgen:auto -->

## Purpose
Member-facing view of the NetworkChain rank bonus.

The admin page answers "what does the company owe?". This one answers the
three questions a member actually has: what rank am I, what is stopping me
from the next one, and who in my team do I need to nudge. Everything comes
from GET /rank-bonus/me, which is self-scoped server-side — there is no way
to view anyone else's tree from here.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Composition

**Renders:** `StatCard`×4 (local), `Check`×2 (lucide-react), `Icon` (local), `Loader2` (lucide-react), `AlertCircle` (lucide-react), `Trophy` (lucide-react), `RefreshCw` (lucide-react), `Lock` (lucide-react), `Minus` (lucide-react)

**Hooks used:** `useState`×5, `useCallback`, `useEffect`

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `default (RankBonusPage)` | component | `RankBonusPage()` | 161 |

## Interfaces

- **Backend endpoints called (via `/backend`):**
  - `GET /backend/rank-bonus/me` (L174)

## Dependencies

- **Internal:**
  - `lib/api.ts` — `api`
- **Packages:**
  - `react` — `useCallback`, `useEffect`, `useState`
  - `lucide-react` — `Trophy`, `Users`, `TrendingUp`, `Loader2`, `AlertCircle`, `Check`, …

## Used by

- `app/(dashboard)/layout.tsx`
