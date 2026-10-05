# `components/livekit/MeetChatPanel.tsx`

> React component `MeetChatPanel`.

**Kind:** React component · **Lines:** 119 · **Directive:** `"use client"`

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Composition

**Renders:** `MessageSquare`×2 (lucide-react), `X` (lucide-react), `Send` (lucide-react)

### Props

- **`MeetChatPanel`**: `isOpen: boolean`, `chatMessages: ReceivedChatMessage[]`, `isSending: boolean`

**Hooks used:** `useState`, `useRef`, `useLocalParticipant` (@livekit/components-react), `useEffect`

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `default (MeetChatPanel)` | component | `MeetChatPanel({ isOpen, onClose, chatMessages, onSend, isSending }: MeetC…)` | 16 |

## Interfaces

None detected: no endpoints, events, data access or environment reads were found.

## Dependencies

- **Internal:** none
- **Packages:**
  - `react` — `useState`, `useRef`, `useEffect`
  - `lucide-react` — `MessageSquare`, `Send`, `X`
  - `@livekit/components-react` — `useLocalParticipant`, `ReceivedChatMessage`

## Used by

No other file imports this one and it has no automatic entry point — it appears unused (or is loaded dynamically by a path the import graph cannot see).
