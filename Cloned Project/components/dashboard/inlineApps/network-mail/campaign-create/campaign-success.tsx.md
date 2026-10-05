# `components/dashboard/inlineApps/network-mail/campaign-create/campaign-success.tsx`

> React component `CampaignSuccessScreen`.

**Kind:** React component · **Lines:** 82 · **Directive:** `"use client"`

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Composition

**Renders:** `ActionButton`×2 (components/dashboard/inlineApps/network-mail/campaign-create/campaign-action-bar.tsx), `Check` (lucide-react)

### Props

- **`CampaignSuccessScreen`**: `campaignData: Partial<CampaignData>`, `onViewDetails: () => void`, `onCreateAnother: () => void`, `onGoToDashboard: () => void`

**Hooks used:** `useEffect`×2, `useState`

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `CampaignSuccessScreen` | component | `CampaignSuccessScreen({ campaignData, onViewDetails, onCreateAnother, onGoToDashb…)` | 10 |

## Interfaces

- **Timers / queues:** `setTimeout` at L40

## Dependencies

- **Internal:**
  - `components/dashboard/inlineApps/network-mail/campaign-create/campaign-action-bar.tsx` — `ActionButton`
  - `components/dashboard/inlineApps/network-mail/campaign-create/utils.ts` — `getScheduleDescription`
  - `components/dashboard/inlineApps/network-mail/campaign-create/types.ts` — `CampaignData`, `(types only)`
- **Packages:**
  - `react` — `useEffect`, `useState`
  - `canvas-confetti`
  - `lucide-react` — `Check`

## Used by

- `components/dashboard/inlineApps/network-mail/campaign-create/campaign-create-flow.tsx`
