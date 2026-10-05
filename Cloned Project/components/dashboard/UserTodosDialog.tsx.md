# `components/dashboard/UserTodosDialog.tsx`

> React component `UserTodosDialog`.

**Kind:** React component · **Lines:** 266 · **Directive:** `"use client"`

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Composition

**Renders:** `Button`×3 (components/ui/button.tsx), `AnimatePresence`×2 (framer-motion), `User` (lucide-react), `X` (lucide-react), `Input` (components/ui/input.tsx), `Plus` (lucide-react), `CheckSquare` (lucide-react), `Trash2` (lucide-react)

### Props

- **`UserTodosDialog`**: `isOpen: boolean`, `onClose: () => void`, `targetUser: { id: string; name: string; email: string; }`

**Hooks used:** `useState`×4, `useEffect`

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `UserTodosDialog` | component | `UserTodosDialog({ isOpen, onClose, targetUser, }: UserTodosDialogProps)` | 32 |

## Interfaces

- **Backend endpoints called (via `/backend`):**
  - `GET /backend/todos/user/${targetUser.id}?orgId=${orgId}` (L53)
  - `POST /backend/todos?orgId=${orgId}` (L75)
  - `DELETE /backend/todos/${todoId}?orgId=${orgId}` (L99)
- **Browser storage / cookies:** `garage_org_id` (localStorage: get)

## Dependencies

- **Internal:**
  - `components/ui/button.tsx` — `Button`
  - `components/ui/input.tsx` — `Input`
  - `lib/utils.ts` — `cn`
  - `lib/api.ts` — `api`
- **Packages:**
  - `react` — `useState`, `useEffect`
  - `framer-motion` — `motion`, `AnimatePresence`
  - `lucide-react` — `CheckSquare`, `Plus`, `X`, `User`, `Trash2`

## Used by

- `app/(dashboard)/workspace/components/UserSpaceCard.tsx`
- `components/dashboard/FeedPageRedesigned.tsx`
