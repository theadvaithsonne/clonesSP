# `app/(dashboard)/taskroom/assigned-to-me/components/comments-panel.tsx`

> React component `CommentsPanel`.

**Kind:** Next.js app-directory module (colocated) · **Lines:** 381 · **Directive:** `"use client"`

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Composition

**Renders:** `Button`×6 (components/ui/button.tsx), `MessageCircle` (lucide-react), `Avatar` (components/ui/avatar.tsx), `AvatarFallback` (components/ui/avatar.tsx), `Textarea` (components/ui/textarea.tsx), `Popover` (components/ui/popover.tsx), `PopoverTrigger` (components/ui/popover.tsx), `MoreVertical` (lucide-react), `PopoverContent` (components/ui/popover.tsx), `PencilLine` (lucide-react), `Trash2` (lucide-react), `Input` (components/ui/input.tsx), `SendHorizonal` (lucide-react)

### Props

- **`CommentsPanel`**: `roomId: string | undefined`, `taskId: string | undefined`, `currentUser: { id: string; name: string; avatarUrl?: string }`, `className?: string`, `userId: string`, `open: boolean`, `employees: Employee[]`

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `CommentsPanel` | component | `CommentsPanel({ roomId, taskId, userId, currentUser, className, open, emp…)` | 39 |

## Interfaces

- **Other fetch/api calls (target not statically resolvable):**
  - `GET ${baseUrlComments}/v1/comments?taskId=${taskId}&roomId=${roomId}` (L75)
  - `POST ${baseUrlComments}/v1/comments` (L101)
  - `DELETE ${baseUrlComments}/v1/comments/${id}` (L133)
  - `PUT ${baseUrlComments}/v1/comments/${id}` (L166)
- **External hosts mentioned in the code:** `uatapi.garage.app`

## Dependencies

- **Internal:**
  - `lib/utils.ts` — `cn`
  - `components/ui/avatar.tsx` — `Avatar`, `AvatarFallback`
  - `components/ui/button.tsx` — `Button`
  - `components/ui/input.tsx` — `Input`
  - `components/ui/textarea.tsx` — `Textarea`
  - `components/ui/popover.tsx` — `Popover`, `PopoverContent`, `PopoverTrigger`
- **Packages:**
  - `react`
  - `date-fns` — `formatDistanceToNow`
  - `lucide-react` — `Trash2`, `SendHorizonal`, `MoreVertical`, `PencilLine`, `MessageCircle`
  - `sonner` — `toast`

## Used by

- `app/(dashboard)/taskroom/assigned-to-me/components/edit-task-dialog.tsx`
