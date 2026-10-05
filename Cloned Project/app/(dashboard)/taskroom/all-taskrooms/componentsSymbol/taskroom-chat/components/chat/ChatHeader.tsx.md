# `app/(dashboard)/taskroom/all-taskrooms/componentsSymbol/taskroom-chat/components/chat/ChatHeader.tsx`

> React component `ChatHeader`.

**Kind:** Next.js app-directory module (colocated) · **Lines:** 126 · **Directive:** `"use client"`

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Composition

**Renders:** `LoadingSpinner` (app/(dashboard)/taskroom/all-taskrooms/componentsSymbol/taskroom-chat/components/shared/LoadingSpinner.tsx), `UserAvatar` (app/(dashboard)/taskroom/all-taskrooms/componentsSymbol/taskroom-chat/components/shared/UserAvatar.tsx)

### Props

- **`ChatHeader`**: `conversationId: string`, `currentUser: string`

**Hooks used:** `useState`×3, `useEffect`×2, `useRef`

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `default (ChatHeader)` | component | `ChatHeader({ conversationId, currentUser }: ChatHeaderProps)` | 14 |

## Interfaces

None detected: no endpoints, events, data access or environment reads were found.

## Dependencies

- **Internal:**
  - `app/(dashboard)/taskroom/all-taskrooms/componentsSymbol/taskroom-chat/lib/chat-api.ts` — `chatAPI`
  - `app/(dashboard)/taskroom/all-taskrooms/componentsSymbol/taskroom-chat/lib/types.ts` — `Conversation`, `User`
  - `app/(dashboard)/taskroom/all-taskrooms/componentsSymbol/taskroom-chat/components/shared/LoadingSpinner.tsx` — `LoadingSpinner (default)`
  - `app/(dashboard)/taskroom/all-taskrooms/componentsSymbol/taskroom-chat/components/shared/UserAvatar.tsx` — `UserAvatar (default)`
- **Packages:**
  - `react` — `useEffect`, `useRef`, `useState`

## Used by

- `app/(dashboard)/taskroom/all-taskrooms/componentsSymbol/taskroom-chat/components/chat/ChatArea.tsx`
