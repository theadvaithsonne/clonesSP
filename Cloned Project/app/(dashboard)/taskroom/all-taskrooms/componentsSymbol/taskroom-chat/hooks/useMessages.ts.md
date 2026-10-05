# `app/(dashboard)/taskroom/all-taskrooms/componentsSymbol/taskroom-chat/hooks/useMessages.ts`

> React hook `useMessages`.

**Kind:** React hook · **Lines:** 144 · **Directive:** `"use client"`

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

**Hooks used:** `useCallback`×6, `useState`×4, `useRef`×3, `useEffect`×3

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `useMessages` | hook | `useMessages(conversationId: string): UseMessagesReturn` | 8 |

## Interfaces

- **Socket.IO events:**
  - listens for: `new_message`

## Dependencies

- **Internal:**
  - `app/(dashboard)/taskroom/all-taskrooms/componentsSymbol/taskroom-chat/lib/chat-api.ts` — `chatAPI`
  - `app/(dashboard)/taskroom/all-taskrooms/componentsSymbol/taskroom-chat/lib/socket-service.ts` — `socketService`
  - `app/(dashboard)/taskroom/all-taskrooms/componentsSymbol/taskroom-chat/lib/types.ts` — `Message`, `UseMessagesReturn`
- **Packages:**
  - `react` — `useCallback`, `useEffect`, `useRef`, `useState`

## Used by

- `app/(dashboard)/taskroom/all-taskrooms/componentsSymbol/taskroom-chat/components/chat/MessageList.tsx`
