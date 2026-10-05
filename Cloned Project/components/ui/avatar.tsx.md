# `components/ui/avatar.tsx`

> React components `Avatar`, `AvatarImage`, `AvatarFallback`.

**Kind:** UI primitive (shadcn/Radix wrapper) · **Lines:** 54 · **Directive:** `"use client"`

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Composition

**Renders:** `AvatarPrimitive`×3 (@radix-ui/react-avatar)

### Props

- **`Avatar`**: `props: React.ComponentProps<typeof AvatarPrimitive.Root>`
- **`AvatarImage`**: `props: React.ComponentProps<typeof AvatarPrimitive.Image>`
- **`AvatarFallback`**: `props: React.ComponentProps<typeof AvatarPrimitive.Fallback>`

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `Avatar` | component | `Avatar({ className, ...props }: React.ComponentProps<typeof Avatar…)` | 53 |
| `AvatarImage` | component | `AvatarImage({ className, ...props }: React.ComponentProps<typeof Avatar…)` | 53 |
| `AvatarFallback` | component | `AvatarFallback({ className, ...props }: React.ComponentProps<typeof Avatar…)` | 53 |

## Interfaces

None detected: no endpoints, events, data access or environment reads were found.

## Dependencies

- **Internal:**
  - `lib/utils.ts` — `cn`
- **Packages:**
  - `react`
  - `@radix-ui/react-avatar`

## Used by

- `app/(dashboard)/auction/page.tsx`
- `app/(dashboard)/flowboard/[symbol]/components/card-activity.tsx`
- `app/(dashboard)/flowboard/[symbol]/components/kanban-board-list-view.tsx`
- `app/(dashboard)/flowboard/[symbol]/components/kanban-board.tsx`
- `app/(dashboard)/flowboard/[symbol]/components/kanban-card.tsx`
- `app/(dashboard)/taskroom/all-taskrooms/componentsSymbol/TaskListView.tsx`
- `app/(dashboard)/taskroom/all-taskrooms/componentsSymbol/chat-view.tsx`
- `app/(dashboard)/taskroom/all-taskrooms/componentsSymbol/comments-panel.tsx`
- `app/(dashboard)/taskroom/all-taskrooms/componentsSymbol/files-view.tsx`
- `app/(dashboard)/taskroom/all-taskrooms/componentsSymbol/kanban-board.tsx`
- `app/(dashboard)/taskroom/all-taskrooms/componentsSymbol/list-view.tsx`
- `app/(dashboard)/taskroom/all-taskrooms/componentsSymbol/right-side-panel.tsx`
- `app/(dashboard)/taskroom/all-taskrooms/componentsSymbol/task-card.tsx`
- `app/(dashboard)/taskroom/all-taskrooms/componentsSymbol/task-search.tsx`
- `app/(dashboard)/taskroom/all-taskrooms/componentsSymbol/taskroom-chat/taskroom-group-chat.tsx`
- `app/(dashboard)/taskroom/all-taskrooms/componentsSymbol/timeline-view.tsx`
- `app/(dashboard)/taskroom/assigned-to-me/components/comments-panel.tsx`
- `app/(dashboard)/taskroom/overview/page.tsx`
- `app/(dashboard)/workspace/components/OccupantAvatar.tsx`
- `app/(dashboard)/workspace/components/OccupantAvatarSmall.tsx`
- `app/(dashboard)/workspace/components/OfficeStreamSection.tsx`
- `app/(dashboard)/workspace/components/UserSpaceCard.tsx`
- `app/garage-admin/(admin-dashboard)/layout.tsx`
- `app/garage-admin/(admin-dashboard)/unilevel-plus-licenses/page.tsx`
- `app/invite/[code]/page.tsx`
- _…and 46 more_
