# `components/dashboard/SpeakerPicker.tsx`

> React component `SpeakerPicker`.

**Kind:** React component · **Lines:** 176 · **Directive:** `"use client"`

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Composition

**Renders:** `Face`×2 (local), `X`×2 (lucide-react), `Search` (lucide-react)

### Props

- **`SpeakerPicker`**: `members: TeamMember[]`, `selectedIds: string[]`, `onChange: (ids: string[]) => void`, `className?: string`

**Hooks used:** `useState`×2, `useRef`, `useMemo`, `useEffect`

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `SpeakerPicker` | component | `SpeakerPicker({ members, selectedIds, onChange, className, }: { members: …)` — Search-and-chips picker for a webinar's speakers: the chosen members sit as removable chips, a search box finds the next one by name or email, and the matches list adds on click. | 43 |

## Interfaces

None detected: no endpoints, events, data access or environment reads were found.

## Dependencies

- **Internal:**
  - `lib/utils.ts` — `cn`
  - `lib/feed-api.ts` — `TeamMember`, `(types only)`
- **Packages:**
  - `react` — `useEffect`, `useMemo`, `useRef`, `useState`
  - `lucide-react` — `Search`, `X`

## Used by

- `components/dashboard/InstantLiveStreamModal.tsx`
- `components/dashboard/WorkshopsPage.tsx`
