# `components/dashboard/MiniChatWindow.tsx`

> React component `MiniChatWindow`.

**Kind:** React component · **Lines:** 249 · **Directive:** `"use client"`

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Composition

**Renders:** `Avatar`×2 (components/ui/avatar.tsx), `AvatarImage`×2 (components/ui/avatar.tsx), `AvatarFallback`×2 (components/ui/avatar.tsx), `DropdownMenu` (components/ui/dropdown-menu.tsx), `DropdownMenuTrigger` (components/ui/dropdown-menu.tsx), `DropdownMenuContent` (components/ui/dropdown-menu.tsx), `DropdownMenuItem` (components/ui/dropdown-menu.tsx), `Star` (lucide-react), `ArrowUpRight` (lucide-react), `ChevronUp` (lucide-react), `Minus` (lucide-react), `X` (lucide-react), `DMPage` (components/dashboard/DMPage.tsx), `GroupPage` (components/dashboard/GroupChatPage.tsx), `GlobalDMPage` (components/dashboard/GlobalDMPage.tsx)

### Props

- **`MiniChatWindow`**: `kind: ChatKind`, `targetId: string`, `targetName: string`, `targetAvatar?: string`, `onClose: () => void`, `onExpand: () => void`, `isFavourite?: boolean`, `onToggleFavourite?: () => void`, `minimized?: boolean`, `onToggleMinimize?: () => void`

**Hooks used:** `useChat` (lib/chat-context.tsx)

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `default (MiniChatWindow)` | component | `MiniChatWindow({ kind, targetId, targetName, targetAvatar, onClose, onExpa…)` | 39 |

## Interfaces

None detected: no endpoints, events, data access or environment reads were found.

## Dependencies

- **Internal:**
  - `lib/utils.ts` — `cn`
  - `components/ui/avatar.tsx` — `Avatar`, `AvatarFallback`, `AvatarImage`
  - `components/ui/dropdown-menu.tsx` — `DropdownMenu`, `DropdownMenuContent`, `DropdownMenuItem`, `DropdownMenuTrigger`
  - `components/dashboard/DMPage.tsx` — `DMPage (default)`
  - `components/dashboard/GroupChatPage.tsx` — `GroupPage (default)`
  - `components/dashboard/GlobalDMPage.tsx` — `GlobalDMPage (default)`
  - `lib/chat-context.tsx` — `useChat`
- **Packages:**
  - `react`
  - `lucide-react` — `X`, `Star`, `ArrowUpRight`, `Minus`, `ChevronUp`
  - `framer-motion` — `motion`

## Used by

- `components/dashboard/RightPanel.tsx`
