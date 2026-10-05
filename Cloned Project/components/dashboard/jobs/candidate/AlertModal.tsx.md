# `components/dashboard/jobs/candidate/AlertModal.tsx`

> Create or edit a job alert: what to match (same criteria as Discover) and how often to email.

**Kind:** React component · **Lines:** 179 · **Directive:** `"use client"`

<!-- docgen:auto -->

## Purpose
Create or edit a job alert: what to match (same criteria as Discover) and
how often to email. Matching runs on the server with the same rules as the
Discover search, so an alert finds exactly what that search shows.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Composition

**Renders:** `TextInput`×6 (components/dashboard/jobs/ui.tsx), `Chip`×4 (components/dashboard/jobs/ui.tsx), `Label`×3 (components/dashboard/jobs/ui.tsx), `Button`×2 (components/dashboard/jobs/ui.tsx), `Modal` (components/dashboard/jobs/ui.tsx)

### Props

- **`AlertModal`**: `open: boolean`, `onClose: () => void`, `initial?: AlertCriteria`, `alert?: JobAlert | null`, `onSaved: (alert: JobAlert) => void`

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `WEEKDAYS` | const | `= ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"]` | 15 |
| `frequencyLabel` | function | `frequencyLabel(alert: Pick<JobAlert, "frequency" \| "weekday">): string` | 17 |
| `criteriaSummary` | function | `criteriaSummary(c: AlertCriteria): string` | 23 |
| `default (AlertModal)` | component | `AlertModal({ open, onClose, initial, alert, onSaved, }: { open: boolea…)` | 36 |

## Interfaces

None detected: no endpoints, events, data access or environment reads were found.

## Dependencies

- **Internal:**
  - `components/dashboard/jobs/constants.ts` — `EMPLOYMENT_LABELS`, `WORKPLACE_LABELS`
  - `components/dashboard/jobs/ui.tsx` — `Button`, `Chip`, `Label`, `Modal`, `TextInput`, `errorMessage`
  - `components/dashboard/jobs/types.ts` — `EmploymentType`, `WorkplaceType`, `(types only)`
  - `components/dashboard/jobs/candidate/candidateApi.ts` — `* as candidateApi`
  - `components/dashboard/jobs/candidate/candidateTypes.ts` — `AlertCriteria`, `AlertFrequency`, `JobAlert`, `(types only)`
- **Packages:**
  - `react`
  - `sonner` — `toast`

## Used by

- `components/dashboard/jobs/candidate/DiscoverPage.tsx`
- `components/dashboard/jobs/candidate/SavedPage.tsx`
