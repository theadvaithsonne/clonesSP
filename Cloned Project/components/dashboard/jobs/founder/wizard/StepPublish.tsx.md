# `components/dashboard/jobs/founder/wizard/StepPublish.tsx`

> A9 · Step 6 — Publish: where the job appears, when it opens and closes, a review of every step, then Publish (which is also when any referral reward hold is taken from GaragePay).

**Kind:** React component · **Lines:** 330 · **Directive:** `"use client"`

<!-- docgen:auto -->

## Purpose
A9 · Step 6 — Publish: where the job appears, when it opens and closes, a
review of every step, then Publish (which is also when any referral reward
hold is taken from GaragePay). Editing an already-published job ends here
with "Done" instead — changes autosave.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Composition

**Renders:** `Card`×3 (components/dashboard/jobs/ui.tsx), `Button`×3 (components/dashboard/jobs/ui.tsx), `SwitchControl`×2 (components/dashboard/jobs/ui.tsx), `Check`×2 (lucide-react), `Building2` (lucide-react), `GraduationCap` (lucide-react), `Globe` (lucide-react), `StepHeading` (components/dashboard/jobs/founder/wizard/StepBasics.tsx), `CopyButton` (components/dashboard/jobs/ui.tsx), `AlertTriangle` (lucide-react)

### Props

- **`StepPublish`**: `job`, `detail`, `update`, `flush`, `onEditStep`

**Hooks used:** `useJobsNav` (components/dashboard/jobs/nav.tsx), `useReferralLink` (components/dashboard/jobs/useReferralLink.ts)

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `default (StepPublish)` | component | `StepPublish({ job, detail, update, flush, onEditStep }: StepProps & { o…)` | 37 |

## Interfaces

None detected: no endpoints, events, data access or environment reads were found.

## Dependencies

- **Internal:**
  - `components/dashboard/jobs/api.ts` — `* as jobsApi`
  - `components/dashboard/jobs/api.ts` — `JobsApiError`
  - `components/dashboard/jobs/constants.ts` — `EMPLOYMENT_LABELS`, `JOB_PAGES`, `WORKPLACE_LABELS`
  - `components/dashboard/jobs/nav.tsx` — `useJobsNav`
  - `components/dashboard/jobs/useReferralLink.ts` — `useReferralLink`
  - `components/dashboard/jobs/ui.tsx` — `Button`, `Card`, `CopyButton`, `GOLD`, `SwitchControl`, `formatDate`, `formatMoney`, `formatSalary`, … +3
  - `components/shared/SellablePublishedModal.tsx` — `showSellablePublished`
  - `components/dashboard/jobs/founder/wizard/JobWizard.tsx` — `StepProps`, `(types only)`
  - `components/dashboard/jobs/founder/wizard/StepBasics.tsx` — `StepHeading`
- **Packages:**
  - `react`
  - `lucide-react` — `AlertTriangle`, `Building2`, `Check`, `Globe`, `GraduationCap`
  - `sonner` — `toast`

## Used by

- `components/dashboard/jobs/founder/wizard/JobWizard.tsx`
