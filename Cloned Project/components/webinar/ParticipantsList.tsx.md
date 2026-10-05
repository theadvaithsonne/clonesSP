# `components/webinar/ParticipantsList.tsx`

> React component `ParticipantsList`.

**Kind:** React component · **Lines:** 613 · **Directive:** `"use client"`

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Composition

**Renders:** `MicOff`×3 (lucide-react), `ParticipantRow`×3 (local), `X`×2 (lucide-react), `Search` (lucide-react), `Pencil` (lucide-react), `Smartphone` (lucide-react), `Monitor` (lucide-react), `ChevronUp` (lucide-react), `ChevronDown` (lucide-react)

### Props

- **`ParticipantsList`**: `socket: Socket | null`, `webinarId: string`

**Hooks used:** `useWebinarStore`×4 (store/webinarStore.ts), `useState`×3, `useMemo`×2, `useAuthStore` (store/authStore.tsx), `useAccessControl` (hooks/office/useAccessControl.ts)

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `default (ParticipantsList)` | component | `ParticipantsList({ socket, webinarId, }: ParticipantsListProps)` | 29 |

## Interfaces

- **Socket.IO events:**
  - emits: `webinar:muteParticipant`, `webinar:removeParticipant`, `webinar:promoteToHost`, `webinar:demoteToAttendee`, `webinar:updateName`

## Dependencies

- **Internal:**
  - `store/webinarStore.ts` — `useWebinarStore (default)`, `detectLocalDeviceType`
  - `store/webinarStore.ts` — `WebinarRole`, `(types only)`
  - `store/authStore.tsx` — `useAuthStore`
  - `hooks/office/useAccessControl.ts` — `useAccessControl`, `PermissionKind`
- **Packages:**
  - `react` — `useMemo`, `useState`
  - `lucide-react` — `MicOff`, `ChevronUp`, `ChevronDown`, `X`, `Pencil`, `Monitor`, …
  - `sonner` — `toast`
  - `socket.io-client` — `Socket`

## Used by

- `app/webinar/[id]/WebinarRoomClient.tsx`
