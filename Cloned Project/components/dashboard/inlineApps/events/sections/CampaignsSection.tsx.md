# `components/dashboard/inlineApps/events/sections/CampaignsSection.tsx`

> React component `CampaignsSection`.

**Kind:** React component · **Lines:** 257 · **Directive:** `"use client"`

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Composition

**Renders:** `Card`×3 (components/dashboard/inlineApps/events/ui.tsx), `Select` (components/dashboard/inlineApps/events/ui.tsx), `TextInput` (components/dashboard/inlineApps/events/ui.tsx), `TextArea` (components/dashboard/inlineApps/events/ui.tsx), `Users` (lucide-react), `Button` (components/dashboard/inlineApps/events/ui.tsx), `Send` (lucide-react), `Mail` (lucide-react)

### Props

- **`CampaignsSection`**: `event: EventProgram`, `metrics: EventMetrics | null`, `onOpenNetworkMail?: (campaignId: string) => void`

**Hooks used:** `useState`×5, `useConfirm` (components/dashboard/inlineApps/events/ui.tsx), `useEffect`

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `default (CampaignsSection)` | component | `CampaignsSection({ event, metrics, onOpenNetworkMail, }: { event: EventProgr…)` | 69 |

## Interfaces

None detected: no endpoints, events, data access or environment reads were found.

## Dependencies

- **Internal:**
  - `components/dashboard/inlineApps/events/ui.tsx` — `Button`, `Card`, `GOLD`, `Select`, `TextArea`, `TextInput`, `useConfirm`
  - `lib/auth.ts` — `getOrgId`
  - `lib/network-mail-campaigns-api.ts` — `createCampaign`
  - `components/dashboard/inlineApps/events/api.ts` — `getCampaignAudience`, `getCampaignRecipients`
  - `components/dashboard/inlineApps/events/types.ts` — `EventMetrics`, `EventProgram`, `(types only)`
- **Packages:**
  - `react` — `useEffect`, `useState`
  - `lucide-react` — `Mail`, `Send`, `Users`
  - `sonner` — `toast`

## Used by

- `components/dashboard/inlineApps/events/EventConsole.tsx`
