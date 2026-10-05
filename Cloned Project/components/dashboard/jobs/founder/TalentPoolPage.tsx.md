# `components/dashboard/jobs/founder/TalentPoolPage.tsx`

> A16 · Talent pool — past applicants who ticked the talent-pool consent on an application form, while that consent lasts.

**Kind:** React component · **Lines:** 302 · **Directive:** `"use client"`

<!-- docgen:auto -->

## Purpose
A16 · Talent pool — past applicants who ticked the talent-pool consent on an
application form, while that consent lasts. Search them, and invite a
selection to apply for one of the office's live roles.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Composition

**Renders:** `FilterMenu`×3 (components/dashboard/jobs/ui.tsx), `Card`×3 (components/dashboard/jobs/ui.tsx), `SearchInput`×2 (components/dashboard/jobs/ui.tsx), `Chip`×2 (components/dashboard/jobs/ui.tsx), `PageHeader` (components/dashboard/jobs/ui.tsx), `Button` (components/dashboard/jobs/ui.tsx), `Send` (lucide-react), `SkeletonRows` (components/dashboard/jobs/ui.tsx), `ErrorState` (components/dashboard/jobs/ui.tsx), `EmptyState` (components/dashboard/jobs/ui.tsx), `Users` (lucide-react), `CandidateRow` (local), `CandidateDrawer` (components/dashboard/jobs/founder/candidate/CandidateDrawer.tsx), `Avatar` (components/dashboard/jobs/ui.tsx)

**Hooks used:** `useLoad` (components/dashboard/jobs/ui.tsx)

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `default (TalentPoolPage)` | component | `TalentPoolPage()` | 43 |

## Interfaces

- **Timers / queues:** `setTimeout` at L57, L61

## Dependencies

- **Internal:**
  - `components/dashboard/jobs/api.ts` — `* as jobsApi`
  - `components/dashboard/jobs/ui.tsx` — `Avatar`, `Button`, `Card`, `Chip`, `EmptyState`, `ErrorState`, `FilterMenu`, `PageHeader`, … +4
  - `components/dashboard/jobs/founder/candidate/CandidateDrawer.tsx` — `CandidateDrawer (default)`
  - `components/dashboard/jobs/types.ts` — `TalentCandidate`, `(types only)`
- **Packages:**
  - `react`
  - `lucide-react` — `Send`, `Users`
  - `sonner` — `toast`

## Used by

- `components/dashboard/jobs/founder/FounderJobsApp.tsx`
