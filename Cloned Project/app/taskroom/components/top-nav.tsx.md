# `app/taskroom/components/top-nav.tsx`

> React component `TopNav`.

**Kind:** Next.js app-directory module (colocated) · **Lines:** 526 · **Directive:** `"use client"`

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Composition

**Renders:** `DropdownMenuItem`×8 (components/ui/dropdown-menu.tsx), `Button`×7 (components/ui/button.tsx), `DropdownMenu`×4 (components/ui/dropdown-menu.tsx), `DropdownMenuTrigger`×4 (components/ui/dropdown-menu.tsx), `DropdownMenuContent`×4 (components/ui/dropdown-menu.tsx), `ChevronDown`×3 (lucide-react), `Settings`×2 (lucide-react), `User`×2 (lucide-react), `Separator`×2 (components/ui/separator.tsx), `Mic`×2 (lucide-react), `MicOff`×2 (lucide-react), `DropdownMenuSeparator`×2 (components/ui/dropdown-menu.tsx), `Plus` (lucide-react), `Search` (lucide-react), `CheckCircle2` (lucide-react), `Popover` (components/ui/popover.tsx), `PopoverTrigger` (components/ui/popover.tsx), `Video` (lucide-react), `PopoverContent` (components/ui/popover.tsx), `Monitor` (lucide-react), `StopCircle` (lucide-react), `Play` (lucide-react), `Avatar` (components/ui/avatar.tsx), `AvatarImage` (components/ui/avatar.tsx), `AvatarFallback` (components/ui/avatar.tsx), `DropdownMenuLabel` (components/ui/dropdown-menu.tsx), `LogOut` (lucide-react)

**Hooks used:** `useUIStore` (store/taskroom/uiStore.tsx), `useWorkspaceStore` (store/taskroom/workspaceStore.ts), `useRouter` (next/navigation), `usePathname` (next/navigation), `useSearchParams` (next/navigation), `useParams` (next/navigation)

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `TopNav` | component | `TopNav()` | 50 |

## Interfaces

- **Timers / queues:** `setInterval` at L188

## Dependencies

- **Internal:**
  - `components/ui/button.tsx` — `Button`
  - `components/ui/avatar.tsx` — `Avatar`, `AvatarFallback`, `AvatarImage`
  - `components/ui/dropdown-menu.tsx` — `DropdownMenu`, `DropdownMenuContent`, `DropdownMenuItem`, `DropdownMenuLabel`, `DropdownMenuSeparator`, `DropdownMenuTrigger`, `DropdownMenuGroup`, `DropdownMenuShortcut`
  - `components/ui/popover.tsx` — `Popover`, `PopoverContent`, `PopoverTrigger`
  - `components/ui/badge.tsx` — `Badge`
  - `components/ui/input.tsx` — `Input`
  - `components/ui/separator.tsx` — `Separator`
  - `store/taskroom/uiStore.tsx` — `useUIStore`
  - `store/taskroom/workspaceStore.ts` — `useWorkspaceStore`
- **Packages:**
  - `react`
  - `lucide-react` — `ChevronDown`, `Search`, `Video`, `Plus`, `CheckCircle2`, `Settings`, …
  - `sonner` — `toast`
  - `next` — `useParams`, `useRouter`, `useSearchParams`, `usePathname`

## Used by

- `app/taskroom/Layout.tsx`
