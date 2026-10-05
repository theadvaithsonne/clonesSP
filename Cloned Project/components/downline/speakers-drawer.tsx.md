# `components/downline/speakers-drawer.tsx`

> Right-side panel listing everyone who fronted a live stream — its host and every co-host.

**Kind:** React component · **Lines:** 102 · **Directive:** `"use client"`

<!-- docgen:auto -->

## Purpose
Right-side panel listing everyone who fronted a live stream — its host and
every co-host. Opened by "View all speakers" on the Live Streams tab, where
the cell only has room for the first one.

Same shell as community-detail-drawer.tsx beside it (overlay + fixed aside +
centred title), so the profile page has one drawer language.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Composition

**Renders:** `X` (lucide-react)

### Props

- **`SpeakersDrawer`**: `drawer: SpeakersDrawerState | null`, `onClose: () => void`

**Hooks used:** `useEffect`

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `SpeakersDrawerState` | type |  | 17 |
| `SpeakersDrawer` | component | `SpeakersDrawer({ drawer, onClose, }: { drawer: SpeakersDrawerState \| null;…)` | 22 |

## Interfaces

None detected: no endpoints, events, data access or environment reads were found.

## Dependencies

- **Internal:**
  - `lib/affiliate/downline-livestreams-api.ts` — `MemberLiveStreamRow`, `(types only)`
  - `lib/country-flag.ts` — `getCountryFlag`
  - `components/ui/data-table/cells.tsx` — `initialsOf`
- **Packages:**
  - `react` — `useEffect`
  - `lucide-react` — `X`

## Used by

- `components/garage-admin/member-profile-view.tsx`
