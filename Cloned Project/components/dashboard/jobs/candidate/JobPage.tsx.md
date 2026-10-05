# `components/dashboard/jobs/candidate/JobPage.tsx`

> B2 / F5 · A job's full page for signed-in members: the description, the apply card, sharing and — for affiliates — the referral card.

**Kind:** React component · **Lines:** 87 · **Directive:** `"use client"`

<!-- docgen:auto -->

## Purpose
B2 / F5 · A job's full page for signed-in members: the description, the
apply card, sharing and — for affiliates — the referral card. A closed role
says so and offers similar roles instead of an apply button.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Composition

**Renders:** `ErrorState`×2 (components/dashboard/jobs/ui.tsx), `ArrowLeft` (lucide-react), `Button` (components/dashboard/jobs/ui.tsx), `LoadingBlock` (components/dashboard/jobs/ui.tsx), `JobDetailView` (components/dashboard/jobs/candidate/JobDetailView.tsx)

**Hooks used:** `useBoardNav` (components/dashboard/jobs/candidate/boardNav.tsx), `useBoardStore` (components/dashboard/jobs/candidate/boardNav.tsx)

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `default (JobPage)` | component | `JobPage()` | 15 |

## Interfaces

None detected: no endpoints, events, data access or environment reads were found.

## Dependencies

- **Internal:**
  - `components/dashboard/jobs/ui.tsx` — `Button`, `ErrorState`, `LoadingBlock`, `errorMessage`
  - `components/dashboard/jobs/candidate/boardNav.tsx` — `BOARD_PAGES`, `referralFor`, `useBoardNav`, `useBoardStore`
  - `components/dashboard/jobs/candidate/candidateApi.ts` — `* as candidateApi`
  - `components/dashboard/jobs/candidate/candidateTypes.ts` — `JobViewResponse`, `(types only)`
  - `components/dashboard/jobs/candidate/JobDetailView.tsx` — `JobDetailView (default)`
- **Packages:**
  - `react`
  - `lucide-react` — `ArrowLeft`

## Used by

- `components/dashboard/jobs/candidate/CandidateJobsApp.tsx`
