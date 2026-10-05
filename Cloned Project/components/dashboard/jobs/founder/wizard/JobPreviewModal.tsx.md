# `components/dashboard/jobs/founder/wizard/JobPreviewModal.tsx`

> How the role reads to candidates: the job card (live preview in Basics and Referral reward) and the full job page (header "Preview").

**Kind:** React component · **Lines:** 168 · **Directive:** `"use client"`

<!-- docgen:auto -->

## Purpose
How the role reads to candidates: the job card (live preview in Basics and
Referral reward) and the full job page (header "Preview").

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Composition

**Renders:** `Chip`×8 (components/dashboard/jobs/ui.tsx), `OrgLogo`×2 (components/dashboard/jobs/ui.tsx), `Bookmark` (lucide-react), `MapPin` (lucide-react), `Briefcase` (lucide-react), `Clock` (lucide-react), `RewardBadge` (components/dashboard/jobs/ui.tsx), `Modal` (components/dashboard/jobs/ui.tsx), `SafeHtml` (components/dashboard/jobs/ui.tsx)

### Props

- **`JobCardPreview`**: `job: Job`, `org: OrgInfo`, `earn?: number | null`, `footer?: React.ReactNode`
- **`JobPreviewModal`**: `open: boolean`, `onClose: () => void`, `job: Job`, `org: OrgInfo`

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `JobCardPreview` | component | `JobCardPreview({ job, org, earn, footer, }: { job: Job; org: OrgInfo; /** …)` | 12 |
| `default (JobPreviewModal)` | component | `JobPreviewModal({ open, onClose, job, org, }: { open: boolean; onClose: () …)` | 86 |

## Interfaces

None detected: no endpoints, events, data access or environment reads were found.

## Dependencies

- **Internal:**
  - `components/dashboard/jobs/constants.ts` — `EMPLOYMENT_LABELS`, `WORKPLACE_LABELS`
  - `components/dashboard/jobs/ui.tsx` — `Chip`, `GOLD`, `Modal`, `OrgLogo`, `RewardBadge`, `SafeHtml`, `formatSalary`
  - `components/dashboard/jobs/types.ts` — `Job`, `OrgInfo`, `(types only)`
- **Packages:**
  - `react`
  - `lucide-react` — `Bookmark`, `Briefcase`, `Clock`, `MapPin`

## Used by

- `components/dashboard/jobs/founder/wizard/JobWizard.tsx`
- `components/dashboard/jobs/founder/wizard/StepBasics.tsx`
- `components/dashboard/jobs/founder/wizard/StepReward.tsx`
