# `components/livekit/MeetParticipantsPanel.tsx`

> React component `MeetParticipantsPanel`.

**Kind:** React component · **Lines:** 120 · **Directive:** `"use client"`

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Composition

**Renders:** `UserX` (lucide-react), `Users` (lucide-react), `X` (lucide-react), `ParticipantRow` (local)

### Props

- **`MeetParticipantsPanel`**: `isOpen: boolean`, `isHost: boolean`

**Hooks used:** `useIsSpeaking` (@livekit/components-react), `useParticipants` (@livekit/components-react)

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `default (MeetParticipantsPanel)` | component | `MeetParticipantsPanel({ isOpen, onClose, isHost, onKick }: MeetParticipantsPanelP…)` | 81 |

## Interfaces

None detected: no endpoints, events, data access or environment reads were found.

## Dependencies

- **Internal:** none
- **Packages:**
  - `lucide-react` — `Users`, `X`, `UserX`
  - `@livekit/components-react` — `useParticipants`, `useIsSpeaking`
  - `livekit-client` — `Participant`

## Used by

No other file imports this one and it has no automatic entry point — it appears unused (or is loaded dynamically by a path the import graph cannot see).
