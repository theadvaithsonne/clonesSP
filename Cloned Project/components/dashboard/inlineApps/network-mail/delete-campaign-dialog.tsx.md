# `components/dashboard/inlineApps/network-mail/delete-campaign-dialog.tsx`

> React component `DeleteCampaignDialog`.

**Kind:** React component · **Lines:** 86 · **Directive:** `"use client"`

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Composition

**Renders:** `Trash2`×2 (lucide-react), `AlertTriangle` (lucide-react)

### Props

- **`DeleteCampaignDialog`**: `open: boolean`, `campaignName: string`, `onClose: () => void`, `onConfirm: () => void`

**Hooks used:** `useState`, `useEffect`

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `DeleteCampaignDialog` | component | `DeleteCampaignDialog({ open, campaignName, onClose, onConfirm, }: DeleteCampaign…)` | 14 |

## Interfaces

None detected: no endpoints, events, data access or environment reads were found.

## Dependencies

- **Internal:** none
- **Packages:**
  - `react` — `useEffect`, `useState`
  - `react-dom` — `createPortal`
  - `lucide-react` — `AlertTriangle`, `Trash2`

## Used by

- `components/dashboard/inlineApps/network-mail/NetworkMailApp.tsx`
