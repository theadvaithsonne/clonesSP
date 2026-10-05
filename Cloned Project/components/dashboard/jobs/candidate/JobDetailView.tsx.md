# `components/dashboard/jobs/candidate/JobDetailView.tsx`

> The job itself as candidates see it — used full-width on the job page (B2) and compact in Discover's detail pane (B1).

**Kind:** React component · **Lines:** 224 · **Directive:** `"use client"`

<!-- docgen:auto -->

## Purpose
The job itself as candidates see it — used full-width on the job page (B2)
and compact in Discover's detail pane (B1). Only what the office chose to
publish: no pipeline, notes or scores.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Composition

**Renders:** `Chip`×8 (components/dashboard/jobs/ui.tsx), `Card`×3 (components/dashboard/jobs/ui.tsx), `Button`×2 (components/dashboard/jobs/ui.tsx), `CopyButton`×2 (components/dashboard/jobs/ui.tsx), `SaveButton` (components/dashboard/jobs/candidate/shared.tsx), `ShieldCheck` (lucide-react), `Gift` (lucide-react), `AlertCircle` (lucide-react), `OrgLogo` (components/dashboard/jobs/ui.tsx), `ExternalLink` (lucide-react), `SafeHtml` (components/dashboard/jobs/ui.tsx)

### Props

- **`JobDetailView`**: `data: JobViewResponse`, `variant: "full" | "pane"`, `onApply: () => void`, `onViewApplication: () => void`, `onOpenFull?: () => void`

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `default (JobDetailView)` | component | `JobDetailView({ data, variant, onApply, onViewApplication, onOpenFull, }:…)` | 23 |

## Interfaces

None detected: no endpoints, events, data access or environment reads were found.

## Dependencies

- **Internal:**
  - `components/dashboard/jobs/ui.tsx` — `Button`, `Card`, `Chip`, `CopyButton`, `GOLD`, `OrgLogo`, `SafeHtml`, `formatDate`, … +1
  - `components/dashboard/jobs/candidate/candidateTypes.ts` — `JobViewResponse`, `(types only)`
  - `components/dashboard/jobs/candidate/shared.tsx` — `SaveButton`, `employmentText`, `experienceText`, `postedText`, `processLabel`, `salaryText`, `workplaceText`
- **Packages:**
  - `react`
  - `lucide-react` — `AlertCircle`, `ExternalLink`, `Gift`, `ShieldCheck`

## Used by

- `components/dashboard/jobs/candidate/DiscoverPage.tsx`
- `components/dashboard/jobs/candidate/JobPage.tsx`
