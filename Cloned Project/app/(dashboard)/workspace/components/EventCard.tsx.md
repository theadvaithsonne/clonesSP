# `app/(dashboard)/workspace/components/EventCard.tsx`

> React component `EventCard`.

**Kind:** Next.js app-directory module (colocated) · **Lines:** 284 · **Directive:** `"use client"`

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Composition

**Renders:** `Loader2`×2 (lucide-react), `Calendar` (lucide-react), `Repeat` (lucide-react), `Clock` (lucide-react), `Play` (lucide-react)

### Props

- **`EventCard`**: `eventId: string`, `title: string`, `startTime: Date`, `endTime: Date`, `creator: EventParticipant`, `invitedUsers: EventParticipant[]`, `occupants: any[]`, `isActive: boolean`, `isLive: boolean`, `isRepeating?: boolean`, `isJoining?: boolean`, `meId: string`, `onJoin: () => void`, `onStartMeeting?: () => void`

**Hooks used:** `useState`

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `EventCard` | component | `memo(function EventCard({ eventId, title, startTime, endTime, creator, invitedUsers, occu…` | 35 |

## Interfaces

- **Backend endpoints called (via `/backend`):**
  - `PATCH /backend/events/${eventId}/start?orgId=${orgId}` (L102)
- **Browser storage / cookies:** `garage_org_id` (localStorage: get)

## Dependencies

- **Internal:**
  - `lib/utils.ts` — `cn`
  - `lib/api.ts` — `api`
  - `lib/auth.ts` — `getToken`
- **Packages:**
  - `react` — `memo`, `useState`
  - `framer-motion` — `motion`
  - `lucide-react` — `Calendar`, `Clock`, `Play`, `Loader2`, `Repeat`
  - `sonner` — `toast`

## Used by

- `app/(dashboard)/workspace/WorkspaceClient.tsx`
