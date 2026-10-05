# `components/garage-admin/RankPersonDrawer.tsx`

> Per-person detail for the Rank Bonus admin page.

**Kind:** React component · **Lines:** 574 · **Directive:** `"use client"`

<!-- docgen:auto -->

## Purpose
Per-person detail for the Rank Bonus admin page.

Answers the questions support actually gets: who referred me, why am I not
Bronze, which of my directs are inactive, what would promote me, and what
have I been paid. Everything comes from one call to
GET /garage-admin/rank-bonus/people/:userId.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Composition

**Renders:** `Section`×6 (local), `RankBadge`×5 (components/garage-admin/RankBadge.tsx), `Avatar`×3 (local), `PersonRow`×2 (local), `Icon` (local), `ActivePill` (components/garage-admin/RankBadge.tsx), `ArrowUpRight` (lucide-react), `AnimatePresence` (framer-motion), `ChevronLeft` (lucide-react), `X` (lucide-react), `SubReasonPill` (components/garage-admin/RankBadge.tsx), `Check` (lucide-react), `Minus` (lucide-react), `PayoutStatusPill` (components/garage-admin/RankBadge.tsx)

### Props

- **`RankPersonDrawer`**: `userId: string | null`, `onClose: () => void`, `onNavigate: (id: string) => void`

**Hooks used:** `useState`×5, `useEffect`×3

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `RankPersonDrawer` | component | `RankPersonDrawer({ userId, onClose, onNavigate, }: { userId: string \| null; …)` | 158 |

## Interfaces

- **garage-admin API called (`my.revenue.network`):**
  - `GET /garage-admin/rank-bonus/people/${userId}` (L185)

## Dependencies

- **Internal:**
  - `lib/api.ts` — `garageAdminApi`
  - `components/garage-admin/RankBadge.tsx` — `RankBadge`, `ActivePill`, `SubReasonPill`, `PayoutStatusPill`
- **Packages:**
  - `react` — `useEffect`, `useState`
  - `react-dom` — `createPortal`
  - `framer-motion` — `AnimatePresence`, `motion`
  - `lucide-react` — `X`, `ArrowUpRight`, `Users`, `GitBranch`, `History`, `Target`, …

## Used by

- `app/garage-admin/(admin-dashboard)/rank-bonus/page.tsx`
