# `app/taskroom/components/create-room-dialog.tsx`

> React component `CreateRoomDialog`.

**Kind:** Next.js app-directory module (colocated) · **Lines:** 477 · **Directive:** `"use client"`

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Composition

**Renders:** `Label`×6 (components/ui/label.tsx), `Avatar`×3 (components/ui/avatar.tsx), `AvatarImage`×3 (components/ui/avatar.tsx), `AvatarFallback`×3 (components/ui/avatar.tsx), `Button`×3 (components/ui/button.tsx), `DropdownMenuItem`×3 (components/ui/dropdown-menu.tsx), `Input`×2 (components/ui/input.tsx), `Switch`×2 (components/ui/switch.tsx), `Dialog` (components/ui/dialog.tsx), `DialogContent` (components/ui/dialog.tsx), `DialogHeader` (components/ui/dialog.tsx), `DialogTitle` (components/ui/dialog.tsx), `Textarea` (components/ui/textarea.tsx), `Popover` (components/ui/popover.tsx), `PopoverTrigger` (components/ui/popover.tsx), `Plus` (lucide-react), `PopoverContent` (components/ui/popover.tsx), `Search` (lucide-react), `CheckCircle2` (lucide-react), `DropdownMenu` (components/ui/dropdown-menu.tsx), `DropdownMenuTrigger` (components/ui/dropdown-menu.tsx), `ChevronDown` (lucide-react), `DropdownMenuPortal` (components/ui/dropdown-menu.tsx), `DropdownMenuContent` (components/ui/dropdown-menu.tsx), `X` (lucide-react), `DialogFooter` (components/ui/dialog.tsx), `Loader2` (lucide-react)

### Props

- **`CreateRoomDialog`**: `open: boolean`, `onOpenChange: (open: boolean) => void`, `spaceId?: string`, `room?: Room | null`

**Hooks used:** `useState`×12, `useEffect`×2, `useRouter` (next/navigation), `useParams` (next/navigation), `useTaskroomWorkspacetore` (store/taskroom/taskroomWorkspace.tsx), `useWorkspaceMemberStore` (store/taskroom/workspaceMemberStore.ts)

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `CreateRoomDialog` | component | `CreateRoomDialog({ open, onOpenChange, spaceId, room }: CreateRoomDialogProps)` | 40 |

## Interfaces

- **Other fetch/api calls (target not statically resolvable):**
  - `GET ${process.env.NEXT_PUBLIC_TASKROOM_URL}room/members?roomId=${targetId}` (L69)
  - `GET ${process.env.NEXT_PUBLIC_TASKROOM_URL}space/members?spaceId=${targetId}` (L100)
  - `DELETE ${process.env.NEXT_PUBLIC_TASKROOM_URL}room/members/${memberRecord._id}` (L158)
- **Environment variables (`process.env`):** `NEXT_PUBLIC_TASKROOM_URL`
- **Browser storage / cookies:** `garage_tok` (localStorage: get)

## Dependencies

- **Internal:**
  - `components/ui/dialog.tsx` — `Dialog`, `DialogContent`, `DialogHeader`, `DialogTitle`, `DialogFooter`
  - `components/ui/dropdown-menu.tsx` — `DropdownMenu`, `DropdownMenuContent`, `DropdownMenuItem`, `DropdownMenuTrigger`, `DropdownMenuPortal`
  - `components/ui/button.tsx` — `Button`
  - `components/ui/input.tsx` — `Input`
  - `components/ui/label.tsx` — `Label`
  - `components/ui/textarea.tsx` — `Textarea`
  - `store/taskroom/taskroomWorkspace.tsx` — `useTaskroomWorkspacetore`, `Room`
  - `components/ui/switch.tsx` — `Switch`
  - `components/ui/popover.tsx` — `Popover`, `PopoverContent`, `PopoverTrigger`
  - `components/ui/avatar.tsx` — `Avatar`, `AvatarFallback`, `AvatarImage`
  - `store/taskroom/workspaceMemberStore.ts` — `useWorkspaceMemberStore`
  - `lib/utils.ts` — `cn`
- **Packages:**
  - `react` — `useState`, `useEffect`
  - `axios`
  - `lucide-react` — `Loader2`, `Search`, `Plus`, `CheckCircle2`, `ChevronDown`, `X`
  - `next` — `useParams`, `useRouter`
  - `sonner` — `toast`

## Used by

- `app/taskroom/components/taskroom-sidebar.tsx`
