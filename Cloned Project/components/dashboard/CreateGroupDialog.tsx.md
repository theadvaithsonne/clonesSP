# `components/dashboard/CreateGroupDialog.tsx`

> React component `CreateGroupDialog`.

**Kind:** React component · **Lines:** 427 · **Directive:** `"use client"`

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Composition

**Renders:** `Plus`×3 (lucide-react), `Checkbox`×3 (components/ui/checkbox.tsx), `Button`×2 (components/ui/button.tsx), `Input`×2 (components/ui/input.tsx), `Dialog` (components/ui/dialog.tsx), `DialogTrigger` (components/ui/dialog.tsx), `Users` (lucide-react), `DialogContent` (components/ui/dialog.tsx), `DialogHeader` (components/ui/dialog.tsx), `DialogTitle` (components/ui/dialog.tsx), `Search` (lucide-react), `Avatar` (components/ui/avatar.tsx), `AvatarImage` (components/ui/avatar.tsx), `AvatarFallback` (components/ui/avatar.tsx), `Bot` (lucide-react), `Badge` (components/ui/badge.tsx), `ListChecks` (lucide-react), `Switch` (components/ui/switch.tsx), `TaskroomLinkPicker` (components/chat/TaskroomLinkPicker.tsx)

### Props

- **`CreateGroupDialog`**: `onCreated?: (id: string, name: string) => void`, `triggerType?: "button" | "icon" | "fab" | "list-item" | "custom"`, `children?: React.ReactNode`

**Hooks used:** `useState`×11, `useMemo`×4, `useAmIFounder` (lib/hooks/useAmIFounder.ts), `useEffect`

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `default (CreateGroupDialog)` | component | `CreateGroupDialog({ onCreated, triggerType = "button", children, }: { /** Rec…)` | 38 |

## Interfaces

- **Backend endpoints called (via `/backend`):**
  - `PUT /backend/groups/${res.group.id}/taskroom` (L199)
- **Browser storage / cookies:** `garage_org_id` (localStorage: get)

## Dependencies

- **Internal:**
  - `lib/api.ts` — `api`
  - `lib/auth.ts` — `getOrgId`, `getToken`
  - `components/ui/button.tsx` — `Button`
  - `components/ui/dialog.tsx` — `Dialog`, `DialogContent`, `DialogHeader`, `DialogTitle`, `DialogTrigger`
  - `components/ui/input.tsx` — `Input`
  - `components/ui/checkbox.tsx` — `Checkbox`
  - `components/ui/avatar.tsx` — `Avatar`, `AvatarFallback`, `AvatarImage`
  - `components/ui/switch.tsx` — `Switch`
  - `components/ui/badge.tsx` — `Badge`
  - `lib/hooks/useAmIFounder.ts` — `useAmIFounder`
  - `components/chat/TaskroomLinkPicker.tsx` — `TaskroomLinkPicker (default)`, `ensureTaskroomAccount`, `LinkChoice`
- **Packages:**
  - `react` — `useEffect`, `useMemo`, `useState`
  - `lucide-react` — `Plus`, `Search`, `Bot`, `Users`, `ListChecks`
  - `sonner` — `toast`

## Used by

- `app/(dashboard)/layout.tsx`
- `components/dashboard/MainSidebar.tsx`
- `components/dashboard/RightPanel.tsx`
