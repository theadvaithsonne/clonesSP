# `components/dashboard/jobs/founder/FounderJobsApp.tsx`

> Garage Jobs — founder console.

**Kind:** React component · **Lines:** 70 · **Directive:** `"use client"`

<!-- docgen:auto -->

## Purpose
Garage Jobs — founder console. The dashboard renders this for every
`Founder:Jobs*` popover and it picks the page. The dashboard hides its
floating bottom bar on these pages: the sidebar carries the Jobs
sub-navigation and the wizard, pipeline and drawers have their own action
bars where it would sit.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Composition

**Renders:** `PostingsPage` (components/dashboard/jobs/founder/PostingsPage.tsx), `JobWizard` (components/dashboard/jobs/founder/wizard/JobWizard.tsx), `JobWorkspace` (components/dashboard/jobs/founder/workspace/JobWorkspace.tsx), `ScorecardPage` (components/dashboard/jobs/founder/candidate/ScorecardPage.tsx), `ApplicationsPage` (components/dashboard/jobs/founder/ApplicationsPage.tsx), `TalentPoolPage` (components/dashboard/jobs/founder/TalentPoolPage.tsx), `PayoutsPage` (components/dashboard/jobs/founder/PayoutsPage.tsx), `SettingsPage` (components/dashboard/jobs/founder/settings/SettingsPage.tsx), `OverviewPage` (components/dashboard/jobs/founder/OverviewPage.tsx), `JobsAccessGate` (components/dashboard/jobs/JobsAccessGate.tsx), `JobsNavProvider` (components/dashboard/jobs/nav.tsx)

### Props

- **`FounderJobsApp`**: `page: string`, `onNavigate: (page: string | null) => void`

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `default (FounderJobsApp)` | component | `FounderJobsApp({ page, onNavigate, }: { page: string; onNavigate: (page: s…)` | 23 |

## Interfaces

None detected: no endpoints, events, data access or environment reads were found.

## Dependencies

- **Internal:**
  - `components/dashboard/jobs/constants.ts` — `JOB_PAGES`
  - `components/dashboard/jobs/nav.tsx` — `JobsNavProvider`
  - `components/dashboard/jobs/JobsAccessGate.tsx` — `JobsAccessGate (default)`
  - `components/dashboard/jobs/founder/OverviewPage.tsx` — `OverviewPage (default)`
  - `components/dashboard/jobs/founder/PostingsPage.tsx` — `PostingsPage (default)`
  - `components/dashboard/jobs/founder/wizard/JobWizard.tsx` — `JobWizard (default)`
  - `components/dashboard/jobs/founder/workspace/JobWorkspace.tsx` — `JobWorkspace (default)`
  - `components/dashboard/jobs/founder/candidate/ScorecardPage.tsx` — `ScorecardPage (default)`
  - `components/dashboard/jobs/founder/ApplicationsPage.tsx` — `ApplicationsPage (default)`
  - `components/dashboard/jobs/founder/TalentPoolPage.tsx` — `TalentPoolPage (default)`
  - `components/dashboard/jobs/founder/PayoutsPage.tsx` — `PayoutsPage (default)`
  - `components/dashboard/jobs/founder/settings/SettingsPage.tsx` — `SettingsPage (default)`
- **Packages:**
  - `react`

## Used by

- `app/(dashboard)/layout.tsx`
