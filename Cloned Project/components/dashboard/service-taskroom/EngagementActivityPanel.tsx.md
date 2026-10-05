# `components/dashboard/service-taskroom/EngagementActivityPanel.tsx`

> The engagement activity drawer, opened from the Taskroom Board when the founder enabled `showActivityLogs`.

**Kind:** React component · **Lines:** 171 · **Directive:** `"use client"`

<!-- docgen:auto -->

## Purpose
The engagement activity drawer, opened from the Taskroom Board when the
founder enabled `showActivityLogs`.

The timeline is assembled server-side from the opt-in, the milestone message
thread and the board itself, so this component only renders — and so the
permission cannot be worked around from the browser. Entries for locked
milestones and internal columns never arrive here.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Composition

**Renders:** `Activity` (lucide-react), `X` (lucide-react), `Loader2` (lucide-react), `Icon` (local)

### Props

- **`EngagementActivityPanel`**: `optInId: string`, `open: boolean`, `onClose: () => void`

**Hooks used:** `useState`×2, `useCallback`, `useEffect`

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `EngagementActivityPanel` | component | `EngagementActivityPanel({ optInId, open, onClose, }: { optInId: string; open: boole…)` | 60 |

## Interfaces

None detected: no endpoints, events, data access or environment reads were found.

## Dependencies

- **Internal:**
  - `lib/utils.ts` — `cn`
  - `lib/feed-api.ts` — `getEngagementActivity`, `EngagementActivityEntry`
- **Packages:**
  - `react` — `useCallback`, `useEffect`, `useState`
  - `lucide-react` — `Activity`, `CheckCircle2`, `CreditCard`, `FileText`, `Loader2`, `MessageCircle`, …

## Used by

- `components/dashboard/ServiceEngagementView.tsx`
- `components/dashboard/service-taskroom/EngagementBoard.tsx`
