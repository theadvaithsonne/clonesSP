# `components/dashboard/inlineApps/network-mail/campaign-create/step-4-review.tsx`

> React component `CampaignStep4Review`.

**Kind:** React component · **Lines:** 608 · **Directive:** `"use client"`

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Composition

**Renders:** `ActionButton`×6 (components/dashboard/inlineApps/network-mail/campaign-create/campaign-action-bar.tsx), `ReviewCard`×5 (local), `ReviewFieldHint`×5 (local), `ReviewFormField`×3 (local), `CheckCircle2` (lucide-react), `AlertTriangle` (lucide-react), `XCircle` (lucide-react), `CampaignStepper` (components/dashboard/inlineApps/network-mail/campaign-create/campaign-stepper.tsx), `CampaignStepHeader` (components/dashboard/inlineApps/network-mail/campaign-create/campaign-create-dialog.tsx), `Monitor` (lucide-react), `Smartphone` (lucide-react), `ResponsiveEmailFrame` (components/shared/EmailTemplatePreview.tsx), `ChecklistIcon` (local), `CampaignActionBar` (components/dashboard/inlineApps/network-mail/campaign-create/campaign-action-bar.tsx)

### Props

- **`CampaignStep4Review`**: `campaignData: Partial<CampaignData>`, `campaignId: string | null`, `isLaunching?: boolean`, `onBack: () => void`, `onEditStep: (step: number) => void`, `onLaunch: () => void | Promise<void>`, `onSaveDraft: () => void | Promise<void>`, `onCampaignDataChange?: (patch: Partial<CampaignData>) => void`, `returnToReview?: boolean`, `onReturnToReview?: () => void`

**Hooks used:** `useState`×11, `useMemo`×5, `useEffect`×2

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `CampaignStep4Review` | component | `CampaignStep4Review({ campaignData, campaignId, isLaunching, onBack, onEditStep…)` | 108 |

## Interfaces

None detected: no endpoints, events, data access or environment reads were found.

## Dependencies

- **Internal:**
  - `lib/network-mail-api.ts` — `getNetworkMailOrgId`, `getTemplate`, `syncTemplateHtmlBody`
  - `lib/network-mail-campaigns-api.ts` — `getNetworkMailSettings`, `sendCampaignTestEmail`
  - `components/dashboard/inlineApps/network-mail/campaign-create/campaign-stepper.tsx` — `CampaignStepper`
  - `components/dashboard/inlineApps/network-mail/campaign-create/campaign-create-dialog.tsx` — `CampaignStepHeader`
  - `components/dashboard/inlineApps/network-mail/campaign-create/campaign-action-bar.tsx` — `CampaignActionBar`, `ActionButton`
  - `components/dashboard/inlineApps/network-mail/campaign-create/constants.ts` — `BLANK_TEMPLATE_ID`
  - `components/dashboard/inlineApps/network-mail/campaign-create/utils.ts` — `formatDisplayDateTime`, `getReviewFieldErrors`, `getScheduleDescription`, `validateCampaign`, `estimateSendMinutes`
  - `components/dashboard/inlineApps/network-mail/campaign-create/types.ts` — `CampaignData`, `(types only)`
  - `components/dashboard/inlineApps/network-mail/email-html-export.ts` — `resolveTemplatePreviewHtml`
  - `components/shared/EmailTemplatePreview.tsx` — `ResponsiveEmailFrame`
- **Packages:**
  - `react` — `useEffect`, `useMemo`, `useState`
  - `lucide-react` — `AlertTriangle`, `CheckCircle2`, `Monitor`, `Smartphone`, `XCircle`
  - `sonner` — `toast`

## Used by

- `components/dashboard/inlineApps/network-mail/campaign-create/campaign-create-flow.tsx`
