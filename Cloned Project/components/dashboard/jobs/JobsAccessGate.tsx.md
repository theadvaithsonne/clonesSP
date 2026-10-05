# `components/dashboard/jobs/JobsAccessGate.tsx`

> Garage Jobs is allow-listed while it rolls out (lib/jobsConfig).

**Kind:** React component · **Lines:** 29 · **Directive:** `"use client"`

<!-- docgen:auto -->

## Purpose
Garage Jobs is allow-listed while it rolls out (lib/jobsConfig). The sidebar
hides the Jobs groups from everyone else; this gate covers the pages too, so
a deep link (?openApp=jobs, an alert email) can't open them either.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Composition

**Renders:** `LoadingBlock` (components/dashboard/jobs/ui.tsx), `EmptyState` (components/dashboard/jobs/ui.tsx), `Lock` (lucide-react)

### Props

- **`JobsAccessGate`**: `children: React.ReactNode`

**Hooks used:** `useAmIFounder` (lib/hooks/useAmIFounder.ts)

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `default (JobsAccessGate)` | component | `JobsAccessGate({ children }: { children: React.ReactNode })` | 13 |

## Interfaces

None detected: no endpoints, events, data access or environment reads were found.

## Dependencies

- **Internal:**
  - `lib/hooks/useAmIFounder.ts` — `useAmIFounder`
  - `lib/jobsConfig.ts` — `isJobsAllowed`
  - `components/dashboard/jobs/ui.tsx` — `EmptyState`, `LoadingBlock`
- **Packages:**
  - `react`
  - `lucide-react` — `Lock`

## Used by

- `components/dashboard/jobs/candidate/CandidateJobsApp.tsx`
- `components/dashboard/jobs/founder/FounderJobsApp.tsx`
