# `app/(dashboard)/taskroom/all-taskrooms/componentsSymbol/taskroom-chat/components/chat/MessageInput.tsx`

> React component `MessageInput`.

**Kind:** Next.js app-directory module (colocated) · **Lines:** 83 · **Directive:** `"use client"`

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Props

- **`MessageInput`**: `props: MessageInputProps`

**Hooks used:** `useState`, `useRef`, `useEffect`

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `default (MessageInput)` | component | `MessageInput({ conversationId, currentUser }: MessageInputProps)` | 7 |

## Interfaces

- **Socket.IO events:**
  - emits: `typing_start`, `typing_stop`, `send_message`
- **Timers / queues:** `setTimeout` at L27

## Dependencies

- **Internal:**
  - `app/(dashboard)/taskroom/all-taskrooms/componentsSymbol/taskroom-chat/lib/types.ts` — `MessageInputProps`
  - `app/(dashboard)/taskroom/all-taskrooms/componentsSymbol/taskroom-chat/lib/socket-service.ts` — `socketService`
- **Packages:**
  - `react` — `useEffect`, `useRef`, `useState`

## Used by

- `app/(dashboard)/taskroom/all-taskrooms/componentsSymbol/taskroom-chat/components/chat/ChatArea.tsx`
