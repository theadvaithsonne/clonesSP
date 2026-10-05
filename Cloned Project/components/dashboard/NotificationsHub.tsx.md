# `components/dashboard/NotificationsHub.tsx`

> React component `NotificationsHub`.

**Kind:** React component · **Lines:** 1101 · **Directive:** `"use client"`

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Composition

**Renders:** `Button`×11 (components/ui/button.tsx), `X`×9 (lucide-react), `Avatar`×8 (components/ui/avatar.tsx), `AvatarImage`×8 (components/ui/avatar.tsx), `AvatarFallback`×8 (components/ui/avatar.tsx), `Bell`×2 (lucide-react), `MessageSquare` (lucide-react), `Users` (lucide-react), `UserPlus` (lucide-react), `Globe` (lucide-react), `AtSign` (lucide-react), `MessageCircle` (lucide-react), `AnimatePresence` (framer-motion), `Check` (lucide-react), `Trash2` (lucide-react)

### Props

- **`NotificationsHub`**: `isOpen: boolean`, `onClose: () => void`

**Hooks used:** `useState`×5, `useEffect`×4, `useRouter` (next/navigation)

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `default (NotificationsHub)` | component | `NotificationsHub({ isOpen, onClose, }: { isOpen: boolean; onClose: () => voi…)` | 123 |

## Interfaces

- **Backend endpoints called (via `/backend`):**
  - `POST /backend/user-notifications/${notificationId}/read` (L236)
  - `DELETE /backend/user-notifications/${notificationId}` (L252)
- **Browser storage / cookies:** `garage_org_id` (localStorage: get)
- **Timers / queues:** `setInterval` at L212

## Dependencies

- **Internal:**
  - `lib/api.ts` — `api`
  - `lib/auth.ts` — `getToken`
  - `components/ui/button.tsx` — `Button`
  - `components/ui/avatar.tsx` — `Avatar`, `AvatarFallback`, `AvatarImage`
  - `lib/utils.ts` — `cn`
- **Packages:**
  - `react` — `useEffect`, `useState`
  - `next` — `useRouter`
  - `framer-motion` — `AnimatePresence`, `motion`
  - `lucide-react` — `Bell`, `X`, `MessageSquare`, `Users`, `UserPlus`, `Trash2`, …

## Used by

- `app/(dashboard)/workspace/WorkspaceClient.tsx`
- `app/(dashboard)/workspace/components/WorkspaceToolbar.tsx`
