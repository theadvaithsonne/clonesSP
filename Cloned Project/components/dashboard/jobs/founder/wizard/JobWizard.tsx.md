# `components/dashboard/jobs/founder/wizard/JobWizard.tsx`

> A3–A9 · "Post a job" — six steps over one draft posting.

**Kind:** React component · **Lines:** 325 · **Directive:** `"use client"`

<!-- docgen:auto -->

## Purpose
A3–A9 · "Post a job" — six steps over one draft posting.

The draft exists from the moment the wizard opens (so nothing is lost), and
every edit autosaves: changes collect in `pending` and flush 800 ms after the
last keystroke, or immediately on Continue / step change / leaving. Nested
objects (salary, description, reward…) are sent as partial patches; arrays
(form, stages, team…) are sent whole.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Composition

**Renders:** `Button`×2 (components/dashboard/jobs/ui.tsx), `ErrorState` (components/dashboard/jobs/ui.tsx), `LoadingBlock` (components/dashboard/jobs/ui.tsx), `ArrowLeft` (lucide-react), `Loader2` (lucide-react), `Eye` (lucide-react), `Check` (lucide-react), `StepBasics` (components/dashboard/jobs/founder/wizard/StepBasics.tsx), `StepDescription` (components/dashboard/jobs/founder/wizard/StepDescription.tsx), `StepForm` (components/dashboard/jobs/founder/wizard/StepForm.tsx), `StepPipeline` (components/dashboard/jobs/founder/wizard/StepPipeline.tsx), `StepReward` (components/dashboard/jobs/founder/wizard/StepReward.tsx), `StepPublish` (components/dashboard/jobs/founder/wizard/StepPublish.tsx), `JobPreviewModal` (components/dashboard/jobs/founder/wizard/JobPreviewModal.tsx)

**Hooks used:** `useJobsNavStore`×3 (components/dashboard/jobs/nav.tsx), `useJobsNav` (components/dashboard/jobs/nav.tsx)

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `WIZARD_STEPS` | const | `= [ { n: 1, title: "Basics" }, { n: 2, title: "Description" }, { n: 3, title: "Applicatio…` | 27 |
| `JobPatch` | type |  | 38 |
| `StepProps` | interface |  | 40 |
| `default (JobWizard)` | component | `JobWizard()` | 83 |

## Interfaces

- **Timers / queues:** `setInterval` at L132; `setTimeout` at L187

## Dependencies

- **Internal:**
  - `components/dashboard/jobs/api.ts` — `* as jobsApi`
  - `components/dashboard/jobs/constants.ts` — `JOB_PAGES`
  - `components/dashboard/jobs/nav.tsx` — `useJobsNav`, `useJobsNavStore`
  - `components/dashboard/jobs/ui.tsx` — `Button`, `ErrorState`, `GOLD`, `LoadingBlock`, `timeAgo`, `errorMessage`
  - `components/dashboard/jobs/types.ts` — `Job`, `JobDetailResponse`, `(types only)`
  - `components/dashboard/jobs/founder/wizard/StepBasics.tsx` — `StepBasics (default)`
  - `components/dashboard/jobs/founder/wizard/StepDescription.tsx` — `StepDescription (default)`
  - `components/dashboard/jobs/founder/wizard/StepForm.tsx` — `StepForm (default)`
  - `components/dashboard/jobs/founder/wizard/StepPipeline.tsx` — `StepPipeline (default)`
  - `components/dashboard/jobs/founder/wizard/StepReward.tsx` — `StepReward (default)`
  - `components/dashboard/jobs/founder/wizard/StepPublish.tsx` — `StepPublish (default)`
  - `components/dashboard/jobs/founder/wizard/JobPreviewModal.tsx` — `JobPreviewModal (default)`
- **Packages:**
  - `react`
  - `lucide-react` — `ArrowLeft`, `Check`, `Eye`, `Loader2`
  - `sonner` — `toast`

## Used by

- `components/dashboard/jobs/founder/FounderJobsApp.tsx`
- `components/dashboard/jobs/founder/wizard/StepBasics.tsx`
- `components/dashboard/jobs/founder/wizard/StepDescription.tsx`
- `components/dashboard/jobs/founder/wizard/StepForm.tsx`
- `components/dashboard/jobs/founder/wizard/StepPipeline.tsx`
- `components/dashboard/jobs/founder/wizard/StepPublish.tsx`
- `components/dashboard/jobs/founder/wizard/StepReward.tsx`
