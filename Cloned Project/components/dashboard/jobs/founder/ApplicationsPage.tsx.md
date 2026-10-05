# `components/dashboard/jobs/founder/ApplicationsPage.tsx`

> A10 · Applications — every candidate across the office's jobs: saved views, filters, sorting, bulk actions (move, reject, tag, star, email, export) and the candidate profile drawer.

**Kind:** React component · **Lines:** 825 · **Directive:** `"use client"`

<!-- docgen:auto -->

## Purpose
A10 · Applications — every candidate across the office's jobs: saved views,
filters, sorting, bulk actions (move, reject, tag, star, email, export) and
the candidate profile drawer.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Composition

**Renders:** `Button`×11 (components/dashboard/jobs/ui.tsx), `FilterMenu`×8 (components/dashboard/jobs/ui.tsx), `BulkButton`×5 (local), `Modal`×3 (components/dashboard/jobs/ui.tsx), `Download`×2 (lucide-react), `Card`×2 (components/dashboard/jobs/ui.tsx), `Star`×2 (lucide-react), `Mail`×2 (lucide-react), `TextInput`×2 (components/dashboard/jobs/ui.tsx), `PageHeader` (components/dashboard/jobs/ui.tsx), `UnderlineTabs` (components/dashboard/jobs/ui.tsx), `SearchInput` (components/dashboard/jobs/ui.tsx), `SkeletonRows` (components/dashboard/jobs/ui.tsx), `ErrorState` (components/dashboard/jobs/ui.tsx), `EmptyState` (components/dashboard/jobs/ui.tsx), `Users` (lucide-react), `Avatar` (components/dashboard/jobs/ui.tsx), `StagePill` (components/dashboard/jobs/ui.tsx), `MatchScore` (components/dashboard/jobs/ui.tsx), `BulkMenu` (local), `ArrowRight` (lucide-react), `XCircle` (lucide-react), `Tag` (lucide-react), `X` (lucide-react), `RejectModal` (local), `TagModal` (local), `EmailModal` (local), `CandidateDrawer` (components/dashboard/jobs/founder/candidate/CandidateDrawer.tsx), `ChevronDown` (lucide-react), `CustomSelect` (components/dashboard/jobs/ui.tsx), `TextArea` (components/dashboard/jobs/ui.tsx)

**Hooks used:** `useJobsNav` (components/dashboard/jobs/nav.tsx), `useJobsNavStore` (components/dashboard/jobs/nav.tsx), `useLoad` (components/dashboard/jobs/ui.tsx)

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `default (ApplicationsPage)` | component | `ApplicationsPage()` | 56 |

## Interfaces

- **Timers / queues:** `setTimeout` at L90

## Dependencies

- **Internal:**
  - `components/dashboard/jobs/api.ts` — `* as jobsApi`
  - `components/dashboard/jobs/constants.ts` — `CATEGORY_META`, `JOB_PAGES`, `SOURCE_LABELS`, `STAGE_CATEGORIES`
  - `components/dashboard/jobs/nav.tsx` — `useJobsNav`, `useJobsNavStore`
  - `components/dashboard/jobs/ui.tsx` — `Avatar`, `Button`, `Card`, `CustomSelect`, `EmptyState`, `ErrorState`, `FilterMenu`, `GOLD`, … +12
  - `components/dashboard/jobs/types.ts` — `ApplicationRow`, `ApplicationSource`, `StageCategory`, `(types only)`
  - `components/dashboard/jobs/founder/candidate/CandidateDrawer.tsx` — `CandidateDrawer (default)`
- **Packages:**
  - `react`
  - `lucide-react` — `ArrowRight`, `ChevronDown`, `Download`, `Mail`, `Star`, `Tag`, …
  - `sonner` — `toast`

## Used by

- `components/dashboard/jobs/founder/FounderJobsApp.tsx`
