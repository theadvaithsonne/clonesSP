# `components/dashboard/InstantLiveStreamModal.tsx`

> React component `InstantLiveStreamModal`.

**Kind:** React component · **Lines:** 329 · **Directive:** `"use client"`

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Composition

**Renders:** `Loader2`×2 (lucide-react), `X` (lucide-react), `WorkshopCommunitySelector` (components/dashboard/WorkshopCommunitySelector.tsx), `SpeakerPicker` (components/dashboard/SpeakerPicker.tsx), `DescriptionEditor` (components/dashboard/DescriptionEditor.tsx), `Upload` (lucide-react), `Trash2` (lucide-react), `ImageIcon` (lucide-react), `Radio` (lucide-react)

### Props

- **`InstantLiveStreamModal`**: `onClose: () => void`, `onSuccess: () => void`, `orgId: string`, `channels: Channel[]`, `members: TeamMember[]`, `orgName?: string | null`

**Hooks used:** `useState`×7, `useRef`

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `InstantLiveStreamModal` | component | `InstantLiveStreamModal({ onClose, onSuccess, orgId, channels, members, orgName, }:…)` — "Go live now" form. Deliberately short compared to CreateWorkshopModal: a community is the only thing we genuinely need, everything else is optional and can be edited afterwards from the live streams list. | 39 |

## Interfaces

None detected: no endpoints, events, data access or environment reads were found.

## Dependencies

- **Internal:**
  - `lib/feed-api.ts` — `createWorkshop`, `generateWorkshopMeeting`, `uploadFile`, `Channel`, `TeamMember`
  - `components/dashboard/DescriptionEditor.tsx` — `DescriptionEditor (default)`
  - `components/shared/SellablePublishedModal.tsx` — `showSellablePublished`
  - `components/dashboard/SpeakerPicker.tsx` — `SpeakerPicker`
  - `components/dashboard/WorkshopCommunitySelector.tsx` — `WorkshopCommunitySelector`
- **Packages:**
  - `react` — `useRef`, `useState`
  - `date-fns` — `format`
  - `lucide-react` — `Image as ImageIcon`, `Loader2`, `Radio`, `Trash2`, `Upload`, `X`
  - `sonner` — `toast`

## Used by

- `components/dashboard/WorkshopsPage.tsx`
