# `components/dashboard/jobs/founder/candidate/ScorecardPage.tsx`

> A13 · Interview scorecard — one interviewer's evaluation of one round.

**Kind:** React component · **Lines:** 579 · **Directive:** `"use client"`

<!-- docgen:auto -->

## Purpose
A13 · Interview scorecard — one interviewer's evaluation of one round.

Criteria start from the interviewer's saved draft, else the job's skills,
else a generic set; each is rated 1–5 with an optional note. Other
interviewers' scorecards stay hidden (the API withholds them) until this
one is submitted, after which the form is read-only and theirs appear.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Composition

**Renders:** `Highlight`×9 (local), `Card`×6 (components/dashboard/jobs/ui.tsx), `Button`×5 (components/dashboard/jobs/ui.tsx), `LoadingBlock`×2 (components/dashboard/jobs/ui.tsx), `Avatar`×2 (components/dashboard/jobs/ui.tsx), `ErrorState` (components/dashboard/jobs/ui.tsx), `ArrowLeft` (lucide-react), `Check` (lucide-react), `MatchScore` (components/dashboard/jobs/ui.tsx), `Chip` (components/dashboard/jobs/ui.tsx), `ExternalLink` (lucide-react), `X` (lucide-react), `Plus` (lucide-react), `TextArea` (components/dashboard/jobs/ui.tsx)

**Hooks used:** `useJobsNav` (components/dashboard/jobs/nav.tsx), `useJobsNavStore` (components/dashboard/jobs/nav.tsx), `useConfirm` (components/dashboard/jobs/ui.tsx)

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `default (ScorecardPage)` | component | `ScorecardPage()` | 87 |

## Interfaces

None detected: no endpoints, events, data access or environment reads were found.

## Dependencies

- **Internal:**
  - `components/dashboard/jobs/api.ts` — `* as jobsApi`
  - `components/dashboard/jobs/constants.ts` — `JOB_PAGES`
  - `components/dashboard/jobs/nav.tsx` — `useJobsNav`, `useJobsNavStore`
  - `components/dashboard/jobs/ui.tsx` — `Avatar`, `Button`, `Card`, `Chip`, `ErrorState`, `GOLD`, `LoadingBlock`, `MatchScore`, … +6
  - `components/dashboard/jobs/types.ts` — `InterviewDetailResponse`, `Scorecard`, `(types only)`
- **Packages:**
  - `react`
  - `lucide-react` — `ArrowLeft`, `Check`, `ExternalLink`, `Plus`, `X`
  - `sonner` — `toast`

## Used by

- `components/dashboard/jobs/founder/FounderJobsApp.tsx`
