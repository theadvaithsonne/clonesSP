# `components/garage-admin/SupportChatTaskroomPanel.tsx`

> Taskroom for one support chat — the admin-console counterpart of the Taskroom section in the app's group chat (GroupAdminPanel / GroupTasksPanel / ManualTaskroomForm).

**Kind:** React component · **Lines:** 316 · **Directive:** `"use client"`

<!-- docgen:auto -->

## Purpose
Taskroom for one support chat — the admin-console counterpart of the
Taskroom section in the app's group chat (GroupAdminPanel / GroupTasksPanel /
ManualTaskroomForm). Those components talk to Taskroom with the end user's
token; garage admins have none, so everything here goes through the
garage-admin API (the backend acts as the support board owner).

A chat files onto its OWN board when an admin gave it one, otherwise onto the
shared support board picked at the top of the Support Chats list. Tasks are
unassigned — they are assigned inside Taskroom. No AI capture yet.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Composition

**Renders:** `Loader2`×4 (lucide-react), `ListChecks`×2 (lucide-react), `Trash2`×2 (lucide-react), `X` (lucide-react), `LayoutGrid` (lucide-react), `Plus` (lucide-react), `CheckCircle2` (lucide-react), `TaskroomBoardDialog` (components/garage-admin/SupportTaskroomPicker.tsx)

### Props

- **`SupportChatTaskroomPanel`**: `groupId: string`, `refreshKey: number`, `onClose: () => void`

**Hooks used:** `useState`×10, `useCallback`×2, `useEffect`×2

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `SupportChatTaskroomPanel` | component | `SupportChatTaskroomPanel({ groupId, refreshKey, onClose, }: { groupId: string; /** B…)` | 37 |

## Interfaces

None detected: no endpoints, events, data access or environment reads were found.

## Dependencies

- **Internal:**
  - `lib/admin-api/support-chats.ts` — `addSupportChatTask`, `getSupportChatTaskroom`, `linkSupportChatTaskroom`, `listSupportChatTasks`, `removeSupportChatTask`, `unlinkSupportChatTaskroom`, `SupportChatTask`, `SupportChatTaskroom`, … +1
  - `components/garage-admin/SupportTaskroomPicker.tsx` — `TaskroomBoardDialog`
- **Packages:**
  - `react` — `useCallback`, `useEffect`, `useState`
  - `lucide-react` — `CheckCircle2`, `LayoutGrid`, `ListChecks`, `Loader2`, `Plus`, `Trash2`, …
  - `sonner` — `toast`

## Used by

- `components/garage-admin/SupportChatsConsole.tsx`
