# `components/chat/GroupAdminPanel.tsx`

> React component `GroupAdminPanel`.

**Kind:** React component · **Lines:** 1138 · **Directive:** `"use client"`

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Composition

**Renders:** `Loader2`×9 (lucide-react), `SelectItem`×5 (components/ui/select.tsx), `Switch`×3 (components/ui/switch.tsx), `ListChecks`×3 (lucide-react), `KanbanSquare`×2 (lucide-react), `TaskroomLinkPicker`×2 (components/chat/TaskroomLinkPicker.tsx), `Trash2`×2 (lucide-react), `LinkIcon`×2 (lucide-react), `Select`×2 (components/ui/select.tsx), `SelectTrigger`×2 (components/ui/select.tsx), `SelectValue`×2 (components/ui/select.tsx), `SelectContent`×2 (components/ui/select.tsx), `Shield` (lucide-react), `X` (lucide-react), `Avatar` (components/ui/avatar.tsx), `AvatarImage` (components/ui/avatar.tsx), `AvatarFallback` (components/ui/avatar.tsx), `Megaphone` (lucide-react), `Paperclip` (lucide-react), `ExternalLink` (lucide-react), `AlertTriangle` (lucide-react), `Sparkles` (lucide-react), `Users` (lucide-react), `ChevronDown` (lucide-react), `RefreshCw` (lucide-react), `Check` (lucide-react), `Copy` (lucide-react), `Timer` (lucide-react)

### Props

- **`GroupAdminPanel`**: `groupId: string`, `userMap: Record<string, MemberLite>`, `onClose: () => void`, `onGroupUpdated?: (group: GroupData) => void`, `onOpenBoard?: (board: TaskroomBoardRef) => Promise<boolean>`, `me: string`

**Hooks used:** `useState`×15, `useEffect`×5, `useMemo`×4, `useRef`×2, `useCallback`

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `GroupTaskroom` | type | The group's Taskroom link, as GET /groups/:id reports it. | 56 |
| `GroupData` | type |  | 80 |
| `default (GroupAdminPanel)` | component | `GroupAdminPanel({ groupId, userMap, onClose, onGroupUpdated, onOpenBoard, m…)` | 142 |

## Interfaces

- **Backend endpoints called (via `/backend`):**
  - `GET /backend/groups/${groupId}` (L194)
  - `PUT /backend/groups/${groupId}/settings` (L255)
  - `PUT /backend/groups/${groupId}/members/${memberId}/role` (L278)
  - `POST /backend/groups/${groupId}/invite-link` (L299)
  - `DELETE /backend/groups/${groupId}/invite-link` (L329)
  - `PUT /backend/groups/${groupId}/taskroom` (L392)
  - `PATCH /backend/groups/${groupId}/taskroom` (L426)
  - `POST /backend/groups/${groupId}/taskroom/sync` (L451)
  - `DELETE /backend/groups/${groupId}/taskroom` (L475)
- **Environment variables (`process.env`):** `NEXT_PUBLIC_APP_URL`
- **Timers / queues:** `setInterval` at L218; `setTimeout` at L362

## Dependencies

- **Internal:**
  - `lib/api.ts` — `api`
  - `lib/auth.ts` — `getToken`
  - `components/ui/avatar.tsx` — `Avatar`, `AvatarFallback`, `AvatarImage`
  - `components/ui/switch.tsx` — `Switch`
  - `components/ui/select.tsx` — `Select`, `SelectContent`, `SelectItem`, `SelectTrigger`, `SelectValue`
  - `components/chat/TaskroomLinkPicker.tsx` — `TaskroomLinkPicker (default)`, `ensureTaskroomAccount`, `openTaskroomBoard`, `LinkChoice`, `TaskroomBoardRef`
- **Packages:**
  - `react` — `useCallback`, `useEffect`, `useMemo`, `useRef`, `useState`
  - `sonner` — `toast`
  - `lucide-react` — `AlertTriangle`, `Check`, `ChevronDown`, `Copy`, `ExternalLink`, `KanbanSquare`, …

## Used by

- `components/dashboard/GroupChatPage.tsx`
