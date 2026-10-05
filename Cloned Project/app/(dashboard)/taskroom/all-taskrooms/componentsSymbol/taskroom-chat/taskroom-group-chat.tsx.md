# `app/(dashboard)/taskroom/all-taskrooms/componentsSymbol/taskroom-chat/taskroom-group-chat.tsx`

> React component `TaskroomGroupChat`.

**Kind:** Next.js app-directory module (colocated) · **Lines:** 260 · **Directive:** `"use client"`

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Composition

**Renders:** `Avatar`×2 (components/ui/avatar.tsx), `AvatarFallback`×2 (components/ui/avatar.tsx), `ChatArea` (app/(dashboard)/taskroom/all-taskrooms/componentsSymbol/taskroom-chat/components/chat/ChatArea.tsx), `Users` (lucide-react), `AlertDialog` (components/ui/alert-dialog.tsx), `AlertDialogTrigger` (components/ui/alert-dialog.tsx), `Button` (components/ui/button.tsx), `Loader2` (lucide-react), `Trash` (lucide-react), `AlertDialogContent` (components/ui/alert-dialog.tsx), `AlertDialogHeader` (components/ui/alert-dialog.tsx), `AlertDialogTitle` (components/ui/alert-dialog.tsx), `AlertDialogDescription` (components/ui/alert-dialog.tsx), `AlertDialogFooter` (components/ui/alert-dialog.tsx), `AlertDialogCancel` (components/ui/alert-dialog.tsx), `AlertDialogAction` (components/ui/alert-dialog.tsx)

### Props

- **`TaskroomGroupChat`**: `conversationId`, `currentUser`, `employees`

**Hooks used:** `useState`×4, `useOnlineUsers` (app/(dashboard)/taskroom/all-taskrooms/componentsSymbol/taskroom-chat/hooks/useOnlineUsers.ts), `useTypingUsers` (app/(dashboard)/taskroom/all-taskrooms/componentsSymbol/taskroom-chat/hooks/useTypingUsers.ts), `useEffect`

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `default (TaskroomGroupChat)` | component | `TaskroomGroupChat({ conversationId, currentUser, employees })` | 37 |

## Interfaces

- **External HTTP calls:**
  - `DELETE uatapi.garage.app/api/chat/conversations/${conversationId}/participants/${userId}` (L23)
- **Browser storage / cookies:** `garage_tok` (localStorage: get)
- **External hosts mentioned in the code:** `uatapi.garage.app`

## Dependencies

- **Internal:**
  - `app/(dashboard)/taskroom/all-taskrooms/componentsSymbol/taskroom-chat/components/chat/ChatArea.tsx` — `ChatArea (default)`
  - `app/(dashboard)/taskroom/all-taskrooms/componentsSymbol/taskroom-chat/hooks/useOnlineUsers.ts` — `useOnlineUsers`
  - `app/(dashboard)/taskroom/all-taskrooms/componentsSymbol/taskroom-chat/hooks/useTypingUsers.ts` — `useTypingUsers`
  - `app/(dashboard)/taskroom/all-taskrooms/componentsSymbol/taskroom-chat/lib/chat-api.ts` — `chatAPI`
  - `app/(dashboard)/taskroom/all-taskrooms/componentsSymbol/taskroom-chat/lib/types.ts` — `Conversation`
  - `components/ui/avatar.tsx` — `Avatar`, `AvatarFallback`
  - `components/ui/alert-dialog.tsx` — `AlertDialog`, `AlertDialogAction`, `AlertDialogCancel`, `AlertDialogFooter`, `AlertDialogContent`, `AlertDialogDescription`, `AlertDialogHeader`, `AlertDialogTitle`, … +1
  - `components/ui/button.tsx` — `Button`
- **Packages:**
  - `react` — `useEffect`, `useState`
  - `sonner` — `toast`
  - `js-cookie`
  - `lucide-react` — `Trash`, `Users`, `Loader2`

## Used by

- `app/(dashboard)/taskroom/all-taskrooms/componentsSymbol/kanban-board.tsx`
