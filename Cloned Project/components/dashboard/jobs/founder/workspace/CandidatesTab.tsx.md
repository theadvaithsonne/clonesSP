# `components/dashboard/jobs/founder/workspace/CandidatesTab.tsx`

> Job workspace · Candidates — every application to this job as a list, by status.

**Kind:** React component · **Lines:** 141 · **Directive:** `"use client"`

<!-- docgen:auto -->

## Purpose
Job workspace · Candidates — every application to this job as a list, by
status. The pipeline shows the active ones by stage; this is where hired,
rejected and withdrawn candidates stay findable.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Composition

**Renders:** `Card`×2 (components/dashboard/jobs/ui.tsx), `UnderlineTabs` (components/dashboard/jobs/ui.tsx), `SearchInput` (components/dashboard/jobs/ui.tsx), `SkeletonRows` (components/dashboard/jobs/ui.tsx), `ErrorState` (components/dashboard/jobs/ui.tsx), `Avatar` (components/dashboard/jobs/ui.tsx), `StagePill` (components/dashboard/jobs/ui.tsx), `MatchScore` (components/dashboard/jobs/ui.tsx)

### Props

- **`CandidatesTab`**: `jobId: string`, `initialStatus?: Status`, `refreshKey: number`, `onOpen: (applicationId: string, ordered: string[]) => void`

**Hooks used:** `useLoad` (components/dashboard/jobs/ui.tsx)

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `default (CandidatesTab)` | component | `CandidatesTab({ jobId, initialStatus = "active", refreshKey, onOpen, }: {…)` | 26 |

## Interfaces

- **Timers / queues:** `setTimeout` at L44

## Dependencies

- **Internal:**
  - `components/dashboard/jobs/api.ts` — `* as jobsApi`
  - `components/dashboard/jobs/constants.ts` — `SOURCE_LABELS`
  - `components/dashboard/jobs/ui.tsx` — `Avatar`, `Card`, `ErrorState`, `MatchScore`, `SearchInput`, `SkeletonRows`, `StagePill`, `UnderlineTabs`, … +3
- **Packages:**
  - `react`

## Used by

- `components/dashboard/jobs/founder/workspace/JobWorkspace.tsx`
