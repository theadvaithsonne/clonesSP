# `components/dashboard/inlineApps/network-mail/campaign-create/campaign-create-dialog.tsx`

> React components `CampaignCreateDialog`, `CampaignStepHeader`.

**Kind:** React component · **Lines:** 81 · **Directive:** `"use client"`

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Composition

**Renders:** `X` (lucide-react)

### Props

- **`CampaignCreateDialog`**: `children: React.ReactNode`, `onClose: () => void`, `loading?: boolean`
- **`CampaignStepHeader`**: `step: number`, `title: string`, `description: string`

**Hooks used:** `useState`, `useEffect`

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `CampaignCreateDialog` | component | `CampaignCreateDialog({ children, onClose, loading, }: { children: React.ReactNod…)` | 7 |
| `CampaignStepHeader` | component | `CampaignStepHeader({ step, title, description, }: { step: number; title: strin…)` | 63 |

## Interfaces

None detected: no endpoints, events, data access or environment reads were found.

## Dependencies

- **Internal:** none
- **Packages:**
  - `react` — `useEffect`, `useState`
  - `react-dom` — `createPortal`
  - `lucide-react` — `X`

## Used by

- `components/dashboard/inlineApps/network-mail/campaign-create/campaign-create-flow.tsx`
- `components/dashboard/inlineApps/network-mail/campaign-create/step-1-template.tsx`
- `components/dashboard/inlineApps/network-mail/campaign-create/step-2-recipients.tsx`
- `components/dashboard/inlineApps/network-mail/campaign-create/step-3-schedule.tsx`
- `components/dashboard/inlineApps/network-mail/campaign-create/step-4-review.tsx`
