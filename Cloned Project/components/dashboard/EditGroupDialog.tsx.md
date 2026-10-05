# `components/dashboard/EditGroupDialog.tsx`

> React component `EditGroupDialog`.

**Kind:** React component · **Lines:** 489 · **Directive:** `"use client"`

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Composition

**Renders:** `Avatar`×3 (components/ui/avatar.tsx), `AvatarImage`×3 (components/ui/avatar.tsx), `AvatarFallback`×3 (components/ui/avatar.tsx), `Button`×3 (components/ui/button.tsx), `Input`×2 (components/ui/input.tsx), `X` (lucide-react), `Camera` (lucide-react), `UserMinus` (lucide-react), `Search` (lucide-react), `Checkbox` (components/ui/checkbox.tsx)

### Props

- **`EditGroupDialog`**: `groupId: string`, `onClose: () => void`, `onUpdated?: () => void`

**Hooks used:** `useState`×12, `useMemo`×2, `useEffect`

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `default (EditGroupDialog)` | component | `EditGroupDialog({ groupId, onClose, onUpdated, }: { groupId: string; onClos…)` | 31 |

## Interfaces

- **Backend endpoints called (via `/backend`):**
  - `GET /backend/groups/${groupId}` (L70)
  - `POST /backend/upload` (L144)
  - `PUT /backend/groups/${groupId}` (L201)
  - `POST /backend/groups/${groupId}/members` (L221)
  - `DELETE /backend/groups/${groupId}/members/${memberId}` (L246)
- **Environment variables (`process.env`):** `NEXT_PUBLIC_API_URL`
- **Browser storage / cookies:** `garage_org_id` (localStorage: get)

## Dependencies

- **Internal:**
  - `lib/api.ts` — `api`
  - `lib/auth.ts` — `getToken`, `getUserIdFromToken`
  - `components/ui/button.tsx` — `Button`
  - `components/ui/input.tsx` — `Input`
  - `components/ui/checkbox.tsx` — `Checkbox`
  - `components/ui/avatar.tsx` — `Avatar`, `AvatarFallback`, `AvatarImage`
- **Packages:**
  - `react` — `useEffect`, `useMemo`, `useState`
  - `lucide-react` — `Search`, `X`, `Camera`, `UserMinus`

## Used by

- `components/dashboard/GroupChatPage.tsx`
