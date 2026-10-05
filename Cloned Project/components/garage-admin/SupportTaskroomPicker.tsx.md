# `components/garage-admin/SupportTaskroomPicker.tsx`

> Where support-chat tasks go.

**Kind:** React component · **Lines:** 255 · **Directive:** `"use client"`

<!-- docgen:auto -->

## Purpose
Where support-chat tasks go. Every support ticket (AI-created from a chat,
or raised by hand) is mirrored as an unassigned card onto ONE Taskroom
board; this bar shows which board and lets a super admin change it.

Listing goes through the backend (GET /garage-admin/tickets/support-board/
options) because garage admins have no Taskroom login of their own — the
backend lists the boards the support board's owner can post to.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Composition

**Renders:** `Loader2`×2 (lucide-react), `LayoutGrid` (lucide-react), `TaskroomBoardDialog` (local), `X` (lucide-react), `ChevronRight` (lucide-react), `Check` (lucide-react)

### Props

- **`TaskroomBoardDialog`**: `title: string`, `subtitle: string`, `currentWorkspaceId?: string | null`, `currentRoomId?: string | null`, `onClose: () => void`, `onSubmit: (workspaceId: string, roomId: string) => Promise<void>`

**Hooks used:** `useState`×7, `useEffect`×2, `useAdminAccess` (components/garage-admin/use-admin-access.ts)

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `SupportTaskroomBar` | component | `SupportTaskroomBar()` | 37 |
| `TaskroomBoardDialog` | component | `TaskroomBoardDialog({ title, subtitle, currentWorkspaceId, currentRoomId, onClo…)` — Workspace + board picker over the boards the support board owner can post to. | 102 |

## Interfaces

- **garage-admin API called (`my.revenue.network`):**
  - `GET ${BASE}/options` (L125)

## Dependencies

- **Internal:**
  - `lib/api.ts` — `garageAdminApi`
  - `components/garage-admin/use-admin-access.ts` — `useAdminAccess`
- **Packages:**
  - `react` — `useEffect`, `useState`
  - `lucide-react` — `Check`, `ChevronRight`, `LayoutGrid`, `Loader2`, `X`
  - `sonner` — `toast`

## Used by

- `components/garage-admin/SupportChatTaskroomPanel.tsx`
- `components/garage-admin/SupportChatsConsole.tsx`
