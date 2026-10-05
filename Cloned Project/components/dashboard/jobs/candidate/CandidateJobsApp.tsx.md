# `components/dashboard/jobs/candidate/CandidateJobsApp.tsx`

> Garage Jobs — the member side (Job Board).

**Kind:** React component · **Lines:** 80 · **Directive:** `"use client"`

<!-- docgen:auto -->

## Purpose
Garage Jobs — the member side (Job Board). The dashboard renders this for
every "Job Board" popover and it picks the screen: Discover, a job, the
apply flow, My Applications or Saved.

Deep link: /workspace?openApp=jobs&jobId=…[&ref=…][&source=…][&apply=1]
opens that job (or straight into its application) and remembers the
referral so the application is credited to whoever shared the link. The
params are then stripped so a reload doesn't replay them.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Composition

**Renders:** `JobPage` (components/dashboard/jobs/candidate/JobPage.tsx), `ApplyFlow` (components/dashboard/jobs/candidate/ApplyFlow.tsx), `MyApplicationsPage` (components/dashboard/jobs/candidate/MyApplicationsPage.tsx), `SavedPage` (components/dashboard/jobs/candidate/SavedPage.tsx), `DiscoverPage` (components/dashboard/jobs/candidate/DiscoverPage.tsx), `JobsAccessGate` (components/dashboard/jobs/JobsAccessGate.tsx), `BoardNavProvider` (components/dashboard/jobs/candidate/boardNav.tsx)

### Props

- **`CandidateJobsApp`**: `page: string`, `onNavigate: (page: string | null) => void`

**Hooks used:** `useBoardStore` (components/dashboard/jobs/candidate/boardNav.tsx)

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `default (CandidateJobsApp)` | component | `CandidateJobsApp({ page, onNavigate, }: { page: string; onNavigate: (page: s…)` | 23 |

## Interfaces

None detected: no endpoints, events, data access or environment reads were found.

## Dependencies

- **Internal:**
  - `components/dashboard/jobs/candidate/ApplyFlow.tsx` — `ApplyFlow (default)`
  - `components/dashboard/jobs/JobsAccessGate.tsx` — `JobsAccessGate (default)`
  - `components/dashboard/jobs/candidate/boardNav.tsx` — `BOARD_PAGES`, `BoardNavProvider`, `rememberReferral`, `useBoardStore`
  - `components/dashboard/jobs/candidate/DiscoverPage.tsx` — `DiscoverPage (default)`
  - `components/dashboard/jobs/candidate/JobPage.tsx` — `JobPage (default)`
  - `components/dashboard/jobs/candidate/MyApplicationsPage.tsx` — `MyApplicationsPage (default)`
  - `components/dashboard/jobs/candidate/SavedPage.tsx` — `SavedPage (default)`
- **Packages:**
  - `react`

## Used by

- `app/(dashboard)/layout.tsx`
