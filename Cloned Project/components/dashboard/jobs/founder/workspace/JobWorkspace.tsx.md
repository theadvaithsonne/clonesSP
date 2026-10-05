# `components/dashboard/jobs/founder/workspace/JobWorkspace.tsx`

> A11 · One job's workspace: header (status, place, reward, actions) and the Pipeline · Candidates · Job details · Application form · Analytics tabs.

**Kind:** React component · **Lines:** 230 · **Directive:** `"use client"`

<!-- docgen:auto -->

## Purpose
A11 · One job's workspace: header (status, place, reward, actions) and the
Pipeline · Candidates · Job details · Application form · Analytics tabs.
The candidate drawer opens over any tab.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Composition

**Renders:** `Button`×2 (components/dashboard/jobs/ui.tsx), `Copy`×2 (lucide-react), `LoadingBlock` (components/dashboard/jobs/ui.tsx), `ErrorState` (components/dashboard/jobs/ui.tsx), `StatusPill` (components/dashboard/jobs/ui.tsx), `RewardBadge` (components/dashboard/jobs/ui.tsx), `Pencil` (lucide-react), `RowMenu` (components/dashboard/jobs/ui.tsx), `Pause` (lucide-react), `Play` (lucide-react), `XCircle` (lucide-react), `UnderlineTabs` (components/dashboard/jobs/ui.tsx), `PipelineBoard` (components/dashboard/jobs/founder/workspace/PipelineBoard.tsx), `CandidatesTab` (components/dashboard/jobs/founder/workspace/CandidatesTab.tsx), `JobDetailsTab` (components/dashboard/jobs/founder/workspace/JobDetailsTab.tsx), `FormTab` (components/dashboard/jobs/founder/workspace/FormTab.tsx), `AnalyticsTab` (components/dashboard/jobs/founder/workspace/AnalyticsTab.tsx), `CandidateDrawer` (components/dashboard/jobs/founder/candidate/CandidateDrawer.tsx)

**Hooks used:** `useJobsNavStore`×4 (components/dashboard/jobs/nav.tsx), `useJobsNav` (components/dashboard/jobs/nav.tsx), `useConfirm` (components/dashboard/jobs/ui.tsx), `useReferralLink` (components/dashboard/jobs/useReferralLink.ts), `useLoad` (components/dashboard/jobs/ui.tsx)

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `default (JobWorkspace)` | component | `JobWorkspace()` | 33 |

## Interfaces

None detected: no endpoints, events, data access or environment reads were found.

## Dependencies

- **Internal:**
  - `components/dashboard/jobs/api.ts` — `* as jobsApi`
  - `components/dashboard/jobs/constants.ts` — `JOB_PAGES`, `WORKPLACE_LABELS`
  - `components/dashboard/jobs/nav.tsx` — `useJobsNav`, `useJobsNavStore`, `JobTab`
  - `components/dashboard/jobs/useReferralLink.ts` — `useReferralLink`
  - `components/dashboard/jobs/ui.tsx` — `Button`, `ErrorState`, `LoadingBlock`, `RewardBadge`, `RowMenu`, `StatusPill`, `UnderlineTabs`, `errorMessage`, … +2
  - `components/dashboard/jobs/founder/candidate/CandidateDrawer.tsx` — `CandidateDrawer (default)`
  - `components/dashboard/jobs/founder/workspace/PipelineBoard.tsx` — `PipelineBoard (default)`
  - `components/dashboard/jobs/founder/workspace/CandidatesTab.tsx` — `CandidatesTab (default)`
  - `components/dashboard/jobs/founder/workspace/JobDetailsTab.tsx` — `JobDetailsTab (default)`
  - `components/dashboard/jobs/founder/workspace/FormTab.tsx` — `FormTab (default)`
  - `components/dashboard/jobs/founder/workspace/AnalyticsTab.tsx` — `AnalyticsTab (default)`
- **Packages:**
  - `react`
  - `lucide-react` — `Copy`, `Pause`, `Pencil`, `Play`, `XCircle`
  - `sonner` — `toast`

## Used by

- `components/dashboard/jobs/founder/FounderJobsApp.tsx`
