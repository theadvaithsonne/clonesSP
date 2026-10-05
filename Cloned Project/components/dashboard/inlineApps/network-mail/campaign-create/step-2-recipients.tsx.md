# `components/dashboard/inlineApps/network-mail/campaign-create/step-2-recipients.tsx`

> React component `CampaignStep2Recipients`.

**Kind:** React component · **Lines:** 987 · **Directive:** `"use client"`

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Composition

**Renders:** `CrmSelectField`×5 (local), `Loader2`×2 (lucide-react), `ActionButton`×2 (components/dashboard/inlineApps/network-mail/campaign-create/campaign-action-bar.tsx), `RadioDot` (local), `ChevronDown` (lucide-react), `CampaignStepper` (components/dashboard/inlineApps/network-mail/campaign-create/campaign-stepper.tsx), `CampaignStepHeader` (components/dashboard/inlineApps/network-mail/campaign-create/campaign-create-dialog.tsx), `SourceOption` (local), `LeadsFilterPanel` (local), `CloudUpload` (lucide-react), `Download` (lucide-react), `FileText` (lucide-react), `Check` (lucide-react), `AlertCircle` (lucide-react), `XCircle` (lucide-react), `CampaignActionBar` (components/dashboard/inlineApps/network-mail/campaign-create/campaign-action-bar.tsx), `ArrowLeft` (lucide-react), `ArrowRight` (lucide-react)

### Props

- **`CampaignStep2Recipients`**: `onNext: (data: RecipientsData) => void`, `onBack: () => void`, `initialData?: RecipientsData`, `returnToReview?: boolean`, `onReturnToReview?: () => void`

**Hooks used:** `useState`×16, `useEffect`×6, `useMemo`×5, `useRef`×2, `useUser` (store/authStore.tsx)

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `CampaignStep2Recipients` | component | `CampaignStep2Recipients({ onNext, onBack, initialData, returnToReview, onReturnToRe…)` | 282 |

## Interfaces

- **Timers / queues:** `setTimeout` at L480, L546

## Dependencies

- **Internal:**
  - `components/dashboard/inlineApps/network-mail/campaign-create/campaign-stepper.tsx` — `CampaignStepper`
  - `components/dashboard/inlineApps/network-mail/campaign-create/campaign-create-dialog.tsx` — `CampaignStepHeader`
  - `components/dashboard/inlineApps/network-mail/campaign-create/campaign-action-bar.tsx` — `CampaignActionBar`, `ActionButton`
  - `components/dashboard/inlineApps/network-mail/campaign-create/constants.ts` — `CRM_LEAD_SOURCE_FILTER_OPTIONS`, `CRM_LEAD_STATUS_FILTER_OPTIONS`
  - `components/dashboard/inlineApps/network-mail/campaign-create/crm-recipients-api.ts` — `getCrmFunnelStages`, `listCrmFunnels`, `listCrmLeadTags`, `CrmFunnelOption`, `CrmFunnelStageOption`
  - `lib/network-mail-campaigns-api.ts` — `getNetworkMailOrgId`, `previewLeadRecipients`, `previewManualRecipients`, `uploadCsvRecipients`
  - `store/authStore.tsx` — `useUser`
  - `components/dashboard/inlineApps/network-mail/campaign-create/utils.ts` — `estimateSendMinutes`, `parseEmails`
  - `components/dashboard/inlineApps/network-mail/campaign-create/types.ts` — `RecipientsData`, `RecipientSource`, `(types only)`
- **Packages:**
  - `react` — `useEffect`, `useMemo`, `useRef`, `useState`
  - `lucide-react` — `AlertCircle`, `ArrowLeft`, `ArrowRight`, `Check`, `ChevronDown`, `CloudUpload`, …

## Used by

- `components/dashboard/inlineApps/network-mail/campaign-create/campaign-create-flow.tsx`
