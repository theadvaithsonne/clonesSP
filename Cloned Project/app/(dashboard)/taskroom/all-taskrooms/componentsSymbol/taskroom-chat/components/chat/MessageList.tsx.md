# `app/(dashboard)/taskroom/all-taskrooms/componentsSymbol/taskroom-chat/components/chat/MessageList.tsx`

> React component `MessageList`.

**Kind:** Next.js app-directory module (colocated) · **Lines:** 260 · **Directive:** `"use client"`

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Composition

**Renders:** `LoadingSpinner`×2 (app/(dashboard)/taskroom/all-taskrooms/componentsSymbol/taskroom-chat/components/shared/LoadingSpinner.tsx), `MessageItem` (app/(dashboard)/taskroom/all-taskrooms/componentsSymbol/taskroom-chat/components/chat/MessageItem.tsx), `TypingIndicator` (app/(dashboard)/taskroom/all-taskrooms/componentsSymbol/taskroom-chat/components/shared/TypingIndicator.tsx)

### Props

- **`MessageList`**: `props: MessageListProps`

**Hooks used:** `useRef`×8, `useEffect`×4, `useMessages` (app/(dashboard)/taskroom/all-taskrooms/componentsSymbol/taskroom-chat/hooks/useMessages.ts), `useTypingUsers` (app/(dashboard)/taskroom/all-taskrooms/componentsSymbol/taskroom-chat/hooks/useTypingUsers.ts), `useState`

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `default (MessageList)` | component | `MessageList({ conversationId, currentUser }: MessageListProps)` | 14 |

## Interfaces

- **Socket.IO events:**
  - emits: `join_conversation`, `leave_conversation`
  - listens for: `connected`, `disconnected`, `connect_error`, `reconnected`

## Dependencies

- **Internal:**
  - `app/(dashboard)/taskroom/all-taskrooms/componentsSymbol/taskroom-chat/hooks/useMessages.ts` — `useMessages`
  - `app/(dashboard)/taskroom/all-taskrooms/componentsSymbol/taskroom-chat/hooks/useTypingUsers.ts` — `useTypingUsers`
  - `app/(dashboard)/taskroom/all-taskrooms/componentsSymbol/taskroom-chat/lib/types.ts` — `MessageListProps`, `Message`
  - `app/(dashboard)/taskroom/all-taskrooms/componentsSymbol/taskroom-chat/components/shared/LoadingSpinner.tsx` — `LoadingSpinner (default)`
  - `app/(dashboard)/taskroom/all-taskrooms/componentsSymbol/taskroom-chat/components/shared/TypingIndicator.tsx` — `TypingIndicator (default)`
  - `app/(dashboard)/taskroom/all-taskrooms/componentsSymbol/taskroom-chat/components/chat/MessageItem.tsx` — `MessageItem (default)`
  - `app/(dashboard)/taskroom/all-taskrooms/componentsSymbol/taskroom-chat/lib/socket-service.ts` — `socketService`
- **Packages:**
  - `react-dom` — `createPortal`
  - `react` — `useEffect`, `useRef`, `useState`
  - `sonner` — `toast`

## Used by

- `app/(dashboard)/taskroom/all-taskrooms/componentsSymbol/taskroom-chat/components/chat/ChatArea.tsx`
