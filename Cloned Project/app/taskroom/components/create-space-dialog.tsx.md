# `app/taskroom/components/create-space-dialog.tsx`

> React component `CreateSpaceDialog`.

**Kind:** Next.js app-directory module (colocated) · **Lines:** 727 · **Directive:** `"use client"`

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Composition

**Renders:** `Label`×5 (components/ui/label.tsx), `Avatar`×4 (components/ui/avatar.tsx), `AvatarImage`×4 (components/ui/avatar.tsx), `AvatarFallback`×4 (components/ui/avatar.tsx), `Input`×3 (components/ui/input.tsx), `Button`×3 (components/ui/button.tsx), `DropdownMenuItem`×3 (components/ui/dropdown-menu.tsx), `Dialog`×2 (components/ui/dialog.tsx), `DialogContent`×2 (components/ui/dialog.tsx), `Popover`×2 (components/ui/popover.tsx), `PopoverTrigger`×2 (components/ui/popover.tsx), `PopoverContent`×2 (components/ui/popover.tsx), `Search`×2 (lucide-react), `Plus`×2 (lucide-react), `X`×2 (lucide-react), `DialogTitle` (components/ui/dialog.tsx), `SelectedLucideIcon` (local), `Textarea` (components/ui/textarea.tsx), `Switch` (components/ui/switch.tsx), `CheckCircle2` (lucide-react), `DropdownMenu` (components/ui/dropdown-menu.tsx), `DropdownMenuTrigger` (components/ui/dropdown-menu.tsx), `ChevronDown` (lucide-react), `DropdownMenuPortal` (components/ui/dropdown-menu.tsx), `DropdownMenuContent` (components/ui/dropdown-menu.tsx), `Loader2` (lucide-react), `AllMembersDialog` (local)

### Props

- **`CreateSpaceDialog`**: `open: boolean`, `onOpenChange: (open: boolean) => void`, `space?: any`

**Hooks used:** `useState`×11, `useParams` (next/navigation), `useSpaceStore` (store/taskroom/spaceStore.ts), `useWorkspaceMemberStore` (store/taskroom/workspaceMemberStore.ts)

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `CreateSpaceDialog` | component | `CreateSpaceDialog({ open, onOpenChange, space }: CreateSpaceDialogProps)` | 141 |

## Interfaces

- **Other fetch/api calls (target not statically resolvable):**
  - `GET ${process.env.NEXT_PUBLIC_TASKROOM_URL}space/members?spaceId=${space._id}` (L188)
  - `DELETE ${process.env.NEXT_PUBLIC_TASKROOM_URL}space/members/${memberRecord._id}` (L273)
- **Environment variables (`process.env`):** `NEXT_PUBLIC_TASKROOM_URL`
- **Browser storage / cookies:** `garage_tok` (localStorage: get)

## Dependencies

- **Internal:**
  - `components/ui/dialog.tsx` — `Dialog`, `DialogContent`, `DialogHeader`, `DialogTitle`, `DialogClose`
  - `components/ui/button.tsx` — `Button`
  - `components/ui/input.tsx` — `Input`
  - `components/ui/label.tsx` — `Label`
  - `components/ui/textarea.tsx` — `Textarea`
  - `components/ui/switch.tsx` — `Switch`
  - `components/ui/popover.tsx` — `Popover`, `PopoverContent`, `PopoverTrigger`
  - `components/ui/dropdown-menu.tsx` — `DropdownMenu`, `DropdownMenuContent`, `DropdownMenuItem`, `DropdownMenuTrigger`, `DropdownMenuPortal`
  - `components/ui/command.tsx` — `Command`, `CommandEmpty`, `CommandGroup`, `CommandInput`, `CommandItem`, `CommandList`
  - `components/ui/avatar.tsx` — `Avatar`, `AvatarFallback`, `AvatarImage`
  - `lib/utils.ts` — `cn`
  - `store/taskroom/spaceStore.ts` — `useSpaceStore`
  - `store/taskroom/workspaceMemberStore.ts` — `useWorkspaceMemberStore`
- **Packages:**
  - `react` — `useState`, `useEffect`
  - `axios`
  - `lucide-react` — `X`, `Plus`, `Search`, `User`, `Users`, `Briefcase`, …
  - `sonner` — `toast`
  - `next` — `useParams`

## Used by

- `app/taskroom/components/taskroom-sidebar.tsx`
