# `components/dashboard/jobs/founder/wizard/StepBasics.tsx`

> A3 · Step 1 — Basics: title, department, openings, employment type, workplace, locations, experience, joining and salary, with a live card.

**Kind:** React component · **Lines:** 315 · **Directive:** `"use client"`

<!-- docgen:auto -->

## Purpose
A3 · Step 1 — Basics: title, department, openings, employment type,
workplace, locations, experience, joining and salary, with a live card.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Composition

**Renders:** `TextInput`×7 (components/dashboard/jobs/ui.tsx), `Label`×3 (components/dashboard/jobs/ui.tsx), `SearchableSelect`×3 (components/ui/searchable-select.tsx), `CustomSelect`×3 (components/dashboard/jobs/ui.tsx), `Chip`×2 (components/dashboard/jobs/ui.tsx), `StepHeading` (local), `Plus` (lucide-react), `Card` (components/dashboard/jobs/ui.tsx), `SwitchControl` (components/dashboard/jobs/ui.tsx), `JobCardPreview` (components/dashboard/jobs/founder/wizard/JobPreviewModal.tsx)

### Props

- **`StepHeading`**: `step: number`, `title: string`, `subtitle?: string`, `right?: React.ReactNode`
- **`StepBasics`**: `props: StepProps`

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `StepHeading` | component | `StepHeading({ step, title, subtitle, right }: { step: number; title: st…)` | 16 |
| `default (StepBasics)` | component | `StepBasics({ job, detail, update }: StepProps)` | 35 |

## Interfaces

None detected: no endpoints, events, data access or environment reads were found.

## Dependencies

- **Internal:**
  - `components/ui/searchable-select.tsx` — `SearchableSelect`, `SearchableOption`
  - `components/dashboard/jobs/constants.ts` — `CURRENCIES`, `EMPLOYMENT_LABELS`
  - `components/dashboard/jobs/ui.tsx` — `Card`, `Chip`, `CustomSelect`, `GOLD`, `Label`, `SwitchControl`, `TextInput`
  - `components/dashboard/jobs/types.ts` — `EmploymentType`, `WorkplaceType`, `(types only)`
  - `components/dashboard/jobs/founder/wizard/JobWizard.tsx` — `StepProps`, `(types only)`
  - `components/dashboard/jobs/founder/wizard/JobPreviewModal.tsx` — `JobCardPreview`
- **Packages:**
  - `react`
  - `lucide-react` — `Plus`
  - `country-state-city` — `Country`, `State`, `City`

## Used by

- `components/dashboard/jobs/founder/wizard/JobWizard.tsx`
- `components/dashboard/jobs/founder/wizard/StepDescription.tsx`
- `components/dashboard/jobs/founder/wizard/StepForm.tsx`
- `components/dashboard/jobs/founder/wizard/StepPipeline.tsx`
- `components/dashboard/jobs/founder/wizard/StepPublish.tsx`
- `components/dashboard/jobs/founder/wizard/StepReward.tsx`
