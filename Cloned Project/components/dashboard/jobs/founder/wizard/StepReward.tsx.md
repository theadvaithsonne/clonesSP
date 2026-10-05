# `components/dashboard/jobs/founder/wizard/StepReward.tsx`

> A8 / F6 · Step 5 — Referral reward: amount per hire, guarantee period and funding from the founder's GaragePay wallet, with the split the live Unilevel Plus plan would pay.

**Kind:** React component · **Lines:** 270 · **Directive:** `"use client"`

<!-- docgen:auto -->

## Purpose
A8 / F6 · Step 5 — Referral reward: amount per hire, guarantee period and
funding from the founder's GaragePay wallet, with the split the live
Unilevel Plus plan would pay. "Add funds" opens the existing GaragePay
top-up sheet; nothing here moves money — publishing does.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Composition

**Renders:** `Card`×4 (components/dashboard/jobs/ui.tsx), `Chip`×2 (components/dashboard/jobs/ui.tsx), `Button`×2 (components/dashboard/jobs/ui.tsx), `StepHeading` (components/dashboard/jobs/founder/wizard/StepBasics.tsx), `SwitchControl` (components/dashboard/jobs/ui.tsx), `Lock` (lucide-react), `AlertTriangle` (lucide-react), `JobCardPreview` (components/dashboard/jobs/founder/wizard/JobPreviewModal.tsx), `Info` (lucide-react), `TopUpStoreWalletSheet` (components/dashboard/TopUpStoreWalletSheet.tsx)

### Props

- **`StepReward`**: `props: StepProps`

**Hooks used:** `useLoad` (components/dashboard/jobs/ui.tsx)

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `default (StepReward)` | component | `StepReward({ job, detail, update }: StepProps)` | 22 |

## Interfaces

- **Timers / queues:** `setTimeout` at L37

## Dependencies

- **Internal:**
  - `lib/auth.ts` — `getOrgId`
  - `components/dashboard/TopUpStoreWalletSheet.tsx` — `TopUpStoreWalletSheet`
  - `components/dashboard/jobs/api.ts` — `* as jobsApi`
  - `components/dashboard/jobs/ui.tsx` — `Button`, `Card`, `Chip`, `GOLD`, `SwitchControl`, `formatMoney`, `useLoad`, `errorMessage`
  - `components/dashboard/jobs/types.ts` — `RewardSplitPreview`, `(types only)`
  - `components/dashboard/jobs/founder/wizard/JobWizard.tsx` — `StepProps`, `(types only)`
  - `components/dashboard/jobs/founder/wizard/StepBasics.tsx` — `StepHeading`
  - `components/dashboard/jobs/founder/wizard/JobPreviewModal.tsx` — `JobCardPreview`
- **Packages:**
  - `react`
  - `lucide-react` — `AlertTriangle`, `Info`, `Lock`

## Used by

- `components/dashboard/jobs/founder/wizard/JobWizard.tsx`
