# `app/(dashboard)/taskroom/all-taskrooms/componentsSymbol/taskroom-chat/hooks/useTypingUsers.ts`

> React hook `useTypingUsers`.

**Kind:** React hook · **Lines:** 51 · **Directive:** `"use client"`

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

**Hooks used:** `useState`, `useEffect`

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `useTypingUsers` | hook | `useTypingUsers()` | 7 |

## Interfaces

- **Socket.IO events:**
  - listens for: `user_typing`

## Dependencies

- **Internal:**
  - `app/(dashboard)/taskroom/all-taskrooms/componentsSymbol/taskroom-chat/lib/socket-service.ts` — `socketService`
  - `app/(dashboard)/taskroom/all-taskrooms/componentsSymbol/taskroom-chat/lib/types.ts` — `TypingUser`
- **Packages:**
  - `react` — `useEffect`, `useState`

## Used by

- `app/(dashboard)/taskroom/all-taskrooms/componentsSymbol/taskroom-chat/components/chat/MessageList.tsx`
- `app/(dashboard)/taskroom/all-taskrooms/componentsSymbol/taskroom-chat/taskroom-group-chat.tsx`
