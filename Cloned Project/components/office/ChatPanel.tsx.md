# `components/office/ChatPanel.tsx`

> React component `ChatPanel`.

**Kind:** React component · **Lines:** 301 · **Directive:** `"use client"`

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Composition

**Renders:** `RecordingBubble` (local)

### Props

- **`ChatPanel`**: `member: Member`, `isFullScreen?: boolean`

**Hooks used:** `useState`×4, `useEffect`×4, `useRef`×2, `useOfficeAuth` (context/office/AuthContext.tsx), `useOfficeSocket` (context/office/SocketContext.tsx), `useCallback`

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `default (ChatPanel)` | component | `ChatPanel({ member, onClose, onCall, isFullScreen = false, }: { membe…)` | 300 |

## Interfaces

- **Next.js API routes called (same origin):**
  - `GET /api/recording/${recordingId}/download` (L28)
  - `GET /api/messages/${member._id}` (L81)
- **Socket.IO events:**
  - emits: `dm_send`
  - listens for: `dm_message`
- **Timers / queues:** `setTimeout` at L118

## Dependencies

- **Internal:**
  - `context/office/AuthContext.tsx` — `useOfficeAuth`
  - `context/office/SocketContext.tsx` — `useOfficeSocket`
  - `lib/office-api.ts` — `officeApi as api`
  - `lib/linkify.tsx` — `linkifyText`
- **Packages:**
  - `react` — `useState`, `useEffect`, `useRef`, `useCallback`

## Used by

No other file imports this one and it has no automatic entry point — it appears unused (or is loaded dynamically by a path the import graph cannot see).
