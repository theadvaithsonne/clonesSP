# `components/dashboard/jobs/founder/PayoutsPage.tsx`

> A15 · Referral payouts — rewards held for open roles, hires inside their guarantee period, rewards paid through the Unilevel Plus plan and rewards cancelled because a hire left early.

**Kind:** React component · **Lines:** 665 · **Directive:** `"use client"`

<!-- docgen:auto -->

## Purpose
A15 · Referral payouts — rewards held for open roles, hires inside their
guarantee period, rewards paid through the Unilevel Plus plan and rewards
cancelled because a hire left early. Each reward opens a drawer with the
split it was (or will be) paid out with.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Composition

**Renders:** `SummaryRow`×7 (local), `SplitLine`×6 (local), `Card`×5 (components/dashboard/jobs/ui.tsx), `Button`×4 (components/dashboard/jobs/ui.tsx), `StatTile`×4 (components/dashboard/jobs/ui.tsx), `SkeletonRows`×2 (components/dashboard/jobs/ui.tsx), `ErrorState`×2 (components/dashboard/jobs/ui.tsx), `Info`×2 (lucide-react), `RewardStatusPill`×2 (local), `SplitBar`×2 (local), `PageHeader` (components/dashboard/jobs/ui.tsx), `Download` (lucide-react), `UnderlineTabs` (components/dashboard/jobs/ui.tsx), `Metrics` (local), `HoldsTable` (local), `EmptyState` (components/dashboard/jobs/ui.tsx), `Wallet` (lucide-react), `RewardsTable` (local), `PayoutDrawer` (local), `LeftEarlyModal` (local), `RowMenu` (components/dashboard/jobs/ui.tsx), `UserRound` (lucide-react), `UserX` (lucide-react), `StatusPill` (components/dashboard/jobs/ui.tsx), `Drawer` (components/dashboard/jobs/ui.tsx), `ExternalLink` (lucide-react), `Modal` (components/dashboard/jobs/ui.tsx), `TextArea` (components/dashboard/jobs/ui.tsx)

**Hooks used:** `useJobsNav` (components/dashboard/jobs/nav.tsx), `useLoad` (components/dashboard/jobs/ui.tsx)

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `default (PayoutsPage)` | component | `PayoutsPage()` | 92 |

## Interfaces

None detected: no endpoints, events, data access or environment reads were found.

## Dependencies

- **Internal:**
  - `components/dashboard/jobs/api.ts` — `* as jobsApi`
  - `components/dashboard/jobs/nav.tsx` — `useJobsNav`
  - `components/dashboard/jobs/ui.tsx` — `Button`, `Card`, `Drawer`, `EmptyState`, `ErrorState`, `GOLD`, `Modal`, `PageHeader`, … +9
  - `components/dashboard/jobs/types.ts` — `PayoutDetailResponse`, `PayoutRow`, `PayoutsResponse`, `RewardStatus`, `(types only)`
- **Packages:**
  - `react`
  - `lucide-react` — `Download`, `ExternalLink`, `Info`, `UserRound`, `UserX`, `Wallet`
  - `sonner` — `toast`

## Used by

- `components/dashboard/jobs/founder/FounderJobsApp.tsx`
