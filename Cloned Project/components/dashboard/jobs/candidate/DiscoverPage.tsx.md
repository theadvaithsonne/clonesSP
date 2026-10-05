# `components/dashboard/jobs/candidate/DiscoverPage.tsx`

> B1 / F4 · Discover — every live role Garage members can apply to, with search and filters, a list on the left and the selected job on the right.

**Kind:** React component · **Lines:** 368 · **Directive:** `"use client"`

<!-- docgen:auto -->

## Purpose
B1 / F4 · Discover — every live role Garage members can apply to, with
search and filters, a list on the left and the selected job on the right.
An empty search offers to turn itself into a job alert.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Composition

**Renders:** `FilterMenu`×7 (components/dashboard/jobs/ui.tsx), `Button`×4 (components/dashboard/jobs/ui.tsx), `Search`×2 (lucide-react), `EmptyState`×2 (components/dashboard/jobs/ui.tsx), `Bell`×2 (lucide-react), `Card`×2 (components/dashboard/jobs/ui.tsx), `MapPin` (lucide-react), `LoadingBlock` (components/dashboard/jobs/ui.tsx), `ErrorState` (components/dashboard/jobs/ui.tsx), `Briefcase` (lucide-react), `JobRow` (local), `DetailPane` (local), `AlertModal` (components/dashboard/jobs/candidate/AlertModal.tsx), `OrgLogo` (components/dashboard/jobs/ui.tsx), `SaveButton` (components/dashboard/jobs/candidate/shared.tsx), `ApplicationBadge` (components/dashboard/jobs/candidate/shared.tsx), `RewardBadge` (components/dashboard/jobs/ui.tsx), `Loader2` (lucide-react), `JobDetailView` (components/dashboard/jobs/candidate/JobDetailView.tsx)

**Hooks used:** `useBoardNav` (components/dashboard/jobs/candidate/boardNav.tsx), `useSavedStore` (components/dashboard/jobs/candidate/boardNav.tsx)

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `default (DiscoverPage)` | component | `DiscoverPage()` | 44 |

## Interfaces

- **Timers / queues:** `setTimeout` at L347

## Dependencies

- **Internal:**
  - `components/dashboard/jobs/constants.ts` — `EMPLOYMENT_LABELS`, `WORKPLACE_LABELS`
  - `components/dashboard/jobs/ui.tsx` — `Button`, `Card`, `EmptyState`, `ErrorState`, `FilterMenu`, `GOLD`, `LoadingBlock`, `OrgLogo`, … +2
  - `components/dashboard/jobs/types.ts` — `EmploymentType`, `WorkplaceType`, `(types only)`
  - `components/dashboard/jobs/candidate/AlertModal.tsx` — `AlertModal (default)`
  - `components/dashboard/jobs/candidate/boardNav.tsx` — `BOARD_PAGES`, `useBoardNav`, `useSavedStore`
  - `components/dashboard/jobs/candidate/candidateApi.ts` — `* as candidateApi`
  - `components/dashboard/jobs/candidate/candidateTypes.ts` — `AlertCriteria`, `JobViewResponse`, `PublicJob`, `(types only)`
  - `components/dashboard/jobs/candidate/JobDetailView.tsx` — `JobDetailView (default)`
  - `components/dashboard/jobs/candidate/shared.tsx` — `ApplicationBadge`, `SaveButton`, `placeText`, `postedText`, `salaryText`
- **Packages:**
  - `react`
  - `lucide-react` — `Bell`, `Briefcase`, `Loader2`, `MapPin`, `Search`

## Used by

- `components/dashboard/jobs/candidate/CandidateJobsApp.tsx`
