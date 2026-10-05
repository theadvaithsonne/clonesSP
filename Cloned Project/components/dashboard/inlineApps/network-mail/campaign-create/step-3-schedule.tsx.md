# `components/dashboard/inlineApps/network-mail/campaign-create/step-3-schedule.tsx`

> React component `CampaignStep3Schedule`.

**Kind:** React component · **Lines:** 475 · **Directive:** `"use client"`

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Composition

**Renders:** `ActionButton`×3 (components/dashboard/inlineApps/network-mail/campaign-create/campaign-action-bar.tsx), `CampaignStepper` (components/dashboard/inlineApps/network-mail/campaign-create/campaign-stepper.tsx), `CampaignStepHeader` (components/dashboard/inlineApps/network-mail/campaign-create/campaign-create-dialog.tsx), `Icon` (local), `Clock` (lucide-react), `CampaignActionBar` (components/dashboard/inlineApps/network-mail/campaign-create/campaign-action-bar.tsx)

### Props

- **`CampaignStep3Schedule`**: `onNext: (data: ScheduleData) => void`, `onBack: () => void`, `initialData?: ScheduleData`, `recipientCount: number`, `campaignName?: string`, `campaignId?: string | null`, `returnToReview?: boolean`, `onReturnToReview?: () => void`

**Hooks used:** `useState`×8, `useMemo`×4

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `CampaignStep3Schedule` | component | `CampaignStep3Schedule({ onNext, onBack, initialData, recipientCount, campaignName…)` | 73 |

## Interfaces

None detected: no endpoints, events, data access or environment reads were found.

## Dependencies

- **Internal:**
  - `lib/network-mail-campaigns-api.ts` — `getNetworkMailOrgId`, `sendCampaignTestEmail`
  - `components/dashboard/inlineApps/network-mail/campaign-create/campaign-stepper.tsx` — `CampaignStepper`
  - `components/dashboard/inlineApps/network-mail/campaign-create/campaign-create-dialog.tsx` — `CampaignStepHeader`
  - `components/dashboard/inlineApps/network-mail/campaign-create/campaign-action-bar.tsx` — `CampaignActionBar`, `ActionButton`
  - `components/dashboard/inlineApps/network-mail/campaign-create/constants.ts` — `RETRY_WAIT_OPTIONS`
  - `components/dashboard/inlineApps/network-mail/campaign-create/utils.ts` — `estimateSendMinutes`, `isWeekend`
  - `components/dashboard/inlineApps/network-mail/campaign-create/types.ts` — `CampaignData`, `ScheduleData`, `ScheduleType`, `(types only)`
- **Packages:**
  - `react` — `useMemo`, `useState`
  - `lucide-react` — `Calendar`, `Clock`, `Zap`
  - `sonner` — `toast`

## Used by

- `components/dashboard/inlineApps/network-mail/campaign-create/campaign-create-flow.tsx`
