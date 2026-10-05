# `app/(dashboard)/workspace/components/HqMeetingRoomCard.tsx`

> React component `HqMeetingRoomCard`.

**Kind:** Next.js app-directory module (colocated) · **Lines:** 277 · **Directive:** `"use client"`

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Composition

**Renders:** `Lock` (lucide-react), `Eye` (lucide-react)

### Props

- **`HqMeetingRoomCard`**: `name?: string`, `currentBooking: RoomBooking | null`, `upcomingBookings: RoomBooking[]`, `allDayBookings?: RoomBooking[]`, `occupants: PeerState[]`, `meId: string`, `isJoining?: boolean`, `maxParticipants?: number`, `onJoin: () => void`, `onBookRoom: () => void`, `onViewSchedule: () => void`

**Hooks used:** `useMemo`×7

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `HqMeetingRoomCard` | component | `memo(function HqMeetingRoomCard({ name = "Conference Room", currentBooking, upcomingBooki…` | 31 |

## Interfaces

None detected: no endpoints, events, data access or environment reads were found.

## Dependencies

- **Internal:**
  - `app/(dashboard)/workspace/types.ts` — `PeerState`, `RoomBooking`
  - `lib/utils.ts` — `cn`
- **Packages:**
  - `react` — `memo`, `useMemo`
  - `framer-motion` — `motion`
  - `lucide-react` — `Lock`, `Users`, `Eye`

## Used by

- `app/(dashboard)/workspace/WorkspaceClient.tsx`
- `components/dashboard/ConferenceRoomPage.tsx`
