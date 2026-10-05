# `components/dashboard/WorkshopCommunitySelector.tsx`

> React component `WorkshopCommunitySelector`.

**Kind:** React component · **Lines:** 212 · **Directive:** `"use client"`

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Composition

**Renders:** `AlertCircle` (lucide-react), `Users` (lucide-react), `Switch` (components/ui/switch.tsx)

### Props

- **`WorkshopCommunitySelector`**: `channels: Channel[]`, `selectedIds: string[]`, `onChange: (ids: string[]) => void`

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `WorkshopCommunitySelector` | component | `WorkshopCommunitySelector({ channels, selectedIds, onChange, }: WorkshopCommunitySele…)` — Community picker for live streams, shared by the schedule form (CreateWorkshopModal) and the instant "Go Live" form. | 23 |

## Interfaces

None detected: no endpoints, events, data access or environment reads were found.

## Dependencies

- **Internal:**
  - `components/ui/switch.tsx` — `Switch`
  - `lib/utils.ts` — `cn`
  - `lib/feed-api.ts` — `Channel`, `(types only)`
- **Packages:**
  - `lucide-react` — `AlertCircle`, `Users`
  - `sonner` — `toast`

## Used by

- `components/dashboard/InstantLiveStreamModal.tsx`
