# `components/dashboard/inlineApps/network-mail/campaign-details-view.tsx`

> React component `CampaignDetailsView`.

**Kind:** React component · **Lines:** 461 · **Directive:** `"use client"`

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Composition

**Renders:** `DetailsCard`×6 (local), `ActionButton`×2 (components/dashboard/inlineApps/network-mail/campaign-create/campaign-action-bar.tsx), `ArrowLeft` (lucide-react), `Monitor` (lucide-react), `Smartphone` (lucide-react), `ResponsiveEmailFrame` (components/shared/EmailTemplatePreview.tsx)

### Props

- **`CampaignDetailsView`**: `campaignId: string`, `onBack: () => void`

**Hooks used:** `useState`×9, `useCallback`×3, `useEffect`×3, `useMemo`

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `CampaignDetailsView` | component | `CampaignDetailsView({ campaignId, onBack, }: { campaignId: string; onBack: () =…)` | 65 |

## Interfaces

- **Timers / queues:** `setInterval` at L154

## Dependencies

- **Internal:**
  - `lib/network-mail-api.ts` — `getNetworkMailOrgId`, `getTemplate`
  - `lib/network-mail-campaigns-api.ts` — `apiCampaignToCampaignData`, `apiStatusToDisplayStatus`, `formatCampaignListDate`, `getCampaign`, `getCampaignReport`, `retryFailedRecipients`, `EmailCampaign`, `FailedRecipient`
  - `components/dashboard/inlineApps/network-mail/campaign-create/campaign-action-bar.tsx` — `ActionButton`
  - `components/dashboard/inlineApps/network-mail/campaign-create/constants.ts` — `BLANK_TEMPLATE_ID`
  - `components/dashboard/inlineApps/network-mail/campaign-create/types.ts` — `CampaignData`, `(types only)`
  - `components/dashboard/inlineApps/network-mail/campaign-create/utils.ts` — `formatDisplayDateTime`, `getScheduleDescription`
  - `components/dashboard/inlineApps/network-mail/email-html-export.ts` — `resolveTemplatePreviewHtml`
  - `components/shared/EmailTemplatePreview.tsx` — `ResponsiveEmailFrame`
  - `components/dashboard/inlineApps/network-mail/campaign-table.tsx` — `CampaignStatus`, `(types only)`
- **Packages:**
  - `react` — `useCallback`, `useEffect`, `useMemo`, `useState`
  - `lucide-react` — `ArrowLeft`, `Monitor`, `Smartphone`
  - `sonner` — `toast`

## Used by

- `components/dashboard/inlineApps/network-mail/NetworkMailApp.tsx`
