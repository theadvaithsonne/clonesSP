# `components/dashboard/jobs/nav.tsx`

> Navigation between the Jobs founder pages.

**Kind:** React component · **Lines:** 100 · **Directive:** `"use client"`

<!-- docgen:auto -->

## Purpose
Navigation between the Jobs founder pages.

Each page is a dashboard popover key (`Founder:Jobs:*`) so the sidebar,
top-bar tab and back/forward history treat it like every other founder page.
Which job / draft / interview a page shows lives in this small store, kept in
sessionStorage so a reload lands back on the same record.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Composition

**Renders:** `JobsNavContext` (local)

### Props

- **`JobsNavProvider`**: `onNavigate: (page: string) => void`, `children: React.ReactNode`

**Hooks used:** `useJobsNavStore` (local)

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `JobTab` | type |  | 15 |
| `useJobsNavStore` | const | `= create<JobsNavState>()( persist( (set) => ({ jobId: null, jobTab: "pipeline", wizardJobId: null, …` | 30 |
| `JobsNav` | interface |  | 56 |
| `JobsNavProvider` | component | `JobsNavProvider({ onNavigate, children, }: { onNavigate: (page: string) => …)` | 66 |
| `useJobsNav` | hook | `useJobsNav(): JobsNav` | 95 |

## Interfaces

None detected: no endpoints, events, data access or environment reads were found.

## Dependencies

- **Internal:**
  - `components/dashboard/jobs/constants.ts` — `JOB_PAGES`
- **Packages:**
  - `react`
  - `zustand` — `create`, `persist`, `createJSONStorage`

## Used by

- `components/dashboard/jobs/founder/ApplicationsPage.tsx`
- `components/dashboard/jobs/founder/FounderJobsApp.tsx`
- `components/dashboard/jobs/founder/OverviewPage.tsx`
- `components/dashboard/jobs/founder/PayoutsPage.tsx`
- `components/dashboard/jobs/founder/PostingsPage.tsx`
- `components/dashboard/jobs/founder/candidate/CandidateDrawer.tsx`
- `components/dashboard/jobs/founder/candidate/ScorecardPage.tsx`
- `components/dashboard/jobs/founder/settings/CareersPageSection.tsx`
- `components/dashboard/jobs/founder/wizard/JobWizard.tsx`
- `components/dashboard/jobs/founder/wizard/StepPipeline.tsx`
- `components/dashboard/jobs/founder/wizard/StepPublish.tsx`
- `components/dashboard/jobs/founder/workspace/JobWorkspace.tsx`
