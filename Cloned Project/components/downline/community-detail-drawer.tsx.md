# `components/downline/community-detail-drawer.tsx`

> Right-side detail sheet for the one-time-affiliate profile's Communities tab — opened by the `>` on the Price and Comp Plan cells.

**Kind:** React component · **Lines:** 164 · **Directive:** `"use client"`

<!-- docgen:auto -->

## Purpose
Right-side detail sheet for the one-time-affiliate profile's Communities
tab — opened by the `>` on the Price and Comp Plan cells. Price shows
currency/frequency/amount/taxes; Comp Plan pages through the channel's
commission levels.
Ported from NetworkChains' components/downline/community-detail-drawer.tsx
(import path swapped to the ported lib/affiliate/downline-profile-api).

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Composition

**Renders:** `DetailRow`×7 (local), `Icon` (local), `X` (lucide-react), `CompLevel` (local)

### Props

- **`CommunityDetailDrawer`**: `drawer: CommunityDrawer | null`, `onClose: () => void`

**Hooks used:** `useState`, `useEffect`

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `CommunityDrawer` | type |  | 14 |
| `CommunityDetailDrawer` | component | `CommunityDetailDrawer({ drawer, onClose, }: { drawer: CommunityDrawer \| null; onC…)` | 52 |

## Interfaces

None detected: no endpoints, events, data access or environment reads were found.

## Dependencies

- **Internal:**
  - `lib/affiliate/downline-profile-api.ts` — `MemberCommunityItem`, `(types only)`
- **Packages:**
  - `react` — `useEffect`, `useState`
  - `lucide-react` — `X`, `Globe`, `CalendarDays`, `AlarmClock`, `Flag`

## Used by

- `components/garage-admin/member-profile-view.tsx`
