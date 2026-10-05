# `app/(dashboard)/taskroom/all-taskrooms/componentsSymbol/taskroom-chat/hooks/useOnlineUsers.ts`

> React hook `useOnlineUsers`.

**Kind:** React hook · **Lines:** 53 · **Directive:** `"use client"`

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

**Hooks used:** `useState`, `useEffect`

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `useOnlineUsers` | hook | `useOnlineUsers()` | 11 |

## Interfaces

- **Socket.IO events:**
  - listens for: `online_users`, `user_online`, `user_offline`

## Dependencies

- **Internal:**
  - `app/(dashboard)/taskroom/all-taskrooms/componentsSymbol/taskroom-chat/lib/socket-service.ts` — `socketService`
- **Packages:**
  - `react` — `useEffect`, `useState`

## Used by

- `app/(dashboard)/taskroom/all-taskrooms/componentsSymbol/taskroom-chat/taskroom-group-chat.tsx`
