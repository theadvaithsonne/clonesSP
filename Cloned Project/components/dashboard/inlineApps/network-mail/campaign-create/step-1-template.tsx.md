# `components/dashboard/inlineApps/network-mail/campaign-create/step-1-template.tsx`

> React component `CampaignStep1Template`.

**Kind:** React component · **Lines:** 242 · **Directive:** `"use client"`

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Composition

**Renders:** `ActionButton`×2 (components/dashboard/inlineApps/network-mail/campaign-create/campaign-action-bar.tsx), `CampaignStepper` (components/dashboard/inlineApps/network-mail/campaign-create/campaign-stepper.tsx), `CampaignStepHeader` (components/dashboard/inlineApps/network-mail/campaign-create/campaign-create-dialog.tsx), `TemplatePickerDropdown` (components/dashboard/inlineApps/network-mail/campaign-create/template-picker-dropdown.tsx), `CampaignActionBar` (components/dashboard/inlineApps/network-mail/campaign-create/campaign-action-bar.tsx), `DiscardDialog` (components/dashboard/inlineApps/network-mail/campaign-create/discard-dialog.tsx), `CreateTemplateModal` (components/dashboard/inlineApps/network-mail/create-template-modal.tsx)

### Props

- **`CampaignStep1Template`**: `onNext: (data: { templateId: string; templateName: string; campaignNa…`, `onCancel: () => void`, `initialData?: { templateId?: string; campaignName?: string; templateN…`, `returnToReview?: boolean`, `onReturnToReview?: () => void`

**Hooks used:** `useState`×9, `useEffect`×2, `useRef`, `useCallback`

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `CampaignStep1Template` | component | `CampaignStep1Template({ onNext, onCancel, initialData, returnToReview, onReturnTo…)` | 38 |

## Interfaces

None detected: no endpoints, events, data access or environment reads were found.

## Dependencies

- **Internal:**
  - `lib/network-mail-api.ts` — `createTemplate`, `formatTemplateListDate`, `getNetworkMailOrgId`, `listTemplates`, `TemplateCategory as MailTemplateCategory`
  - `components/dashboard/inlineApps/network-mail/create-template-modal.tsx` — `CreateTemplateModal`
  - `components/dashboard/inlineApps/network-mail/campaign-create/campaign-stepper.tsx` — `CampaignStepper`
  - `components/dashboard/inlineApps/network-mail/campaign-create/campaign-action-bar.tsx` — `CampaignActionBar`, `ActionButton`
  - `components/dashboard/inlineApps/network-mail/campaign-create/campaign-create-dialog.tsx` — `CampaignStepHeader`
  - `components/dashboard/inlineApps/network-mail/campaign-create/discard-dialog.tsx` — `DiscardDialog`
  - `components/dashboard/inlineApps/network-mail/campaign-create/types.ts` — `CampaignTemplateItem`, `(types only)`
  - `components/dashboard/inlineApps/network-mail/campaign-create/template-picker-dropdown.tsx` — `TemplatePickerDropdown`
- **Packages:**
  - `react` — `useCallback`, `useEffect`, `useRef`, `useState`
  - `sonner` — `toast`

## Used by

- `components/dashboard/inlineApps/network-mail/campaign-create/campaign-create-flow.tsx`
