# `components/dashboard/inlineApps/network-mail/campaign-create/campaign-create-flow.tsx`

> React component `CampaignCreateFlow`.

**Kind:** React component · **Lines:** 435 · **Directive:** `"use client"`

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Composition

**Renders:** `CampaignCreateDialog`×3 (components/dashboard/inlineApps/network-mail/campaign-create/campaign-create-dialog.tsx), `CampaignSuccessScreen` (components/dashboard/inlineApps/network-mail/campaign-create/campaign-success.tsx), `CampaignStep1Template` (components/dashboard/inlineApps/network-mail/campaign-create/step-1-template.tsx), `CampaignStep2Recipients` (components/dashboard/inlineApps/network-mail/campaign-create/step-2-recipients.tsx), `CampaignStep3Schedule` (components/dashboard/inlineApps/network-mail/campaign-create/step-3-schedule.tsx), `CampaignStep4Review` (components/dashboard/inlineApps/network-mail/campaign-create/step-4-review.tsx), `DiscardDialog` (components/dashboard/inlineApps/network-mail/campaign-create/discard-dialog.tsx)

### Props

- **`CampaignCreateFlow`**: `onExit: () => void`, `onSaved?: () => void`, `editCampaignId?: string`

**Hooks used:** `useState`×10, `useEffect`×3, `useRef`, `useCallback`

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `CampaignCreateFlow` | component | `CampaignCreateFlow({ onExit, onSaved, editCampaignId, }: { onExit: () => void;…)` | 38 |

## Interfaces

- **Timers / queues:** `setInterval` at L162

## Dependencies

- **Internal:**
  - `lib/network-mail-campaigns-api.ts` — `apiCampaignToCampaignData`, `campaignDataToApiPayload`, `createCampaign`, `getCampaign`, `getNetworkMailOrgId`, `getNetworkMailSettings`, `launchCampaign`, `updateCampaign`
  - `lib/network-mail-api.ts` — `recordTemplateUse`, `syncTemplateHtmlBody`
  - `components/dashboard/inlineApps/network-mail/campaign-create/campaign-create-dialog.tsx` — `CampaignCreateDialog`
  - `components/dashboard/inlineApps/network-mail/campaign-create/step-1-template.tsx` — `CampaignStep1Template`
  - `components/dashboard/inlineApps/network-mail/campaign-create/step-2-recipients.tsx` — `CampaignStep2Recipients`
  - `components/dashboard/inlineApps/network-mail/campaign-create/step-3-schedule.tsx` — `CampaignStep3Schedule`
  - `components/dashboard/inlineApps/network-mail/campaign-create/step-4-review.tsx` — `CampaignStep4Review`
  - `components/dashboard/inlineApps/network-mail/campaign-create/campaign-success.tsx` — `CampaignSuccessScreen`
  - `components/dashboard/inlineApps/network-mail/campaign-create/discard-dialog.tsx` — `DiscardDialog`
  - `components/dashboard/inlineApps/network-mail/campaign-create/types.ts` — `CampaignData`, `RecipientsData`, `ScheduleData`, `(types only)`
- **Packages:**
  - `react` — `useCallback`, `useEffect`, `useRef`, `useState`
  - `sonner` — `toast`

## Used by

- `components/dashboard/inlineApps/network-mail/NetworkMailApp.tsx`
