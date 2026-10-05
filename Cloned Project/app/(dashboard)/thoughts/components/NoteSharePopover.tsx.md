# `app/(dashboard)/thoughts/components/NoteSharePopover.tsx`

> React component `NoteSharePopover`.

**Kind:** Next.js app-directory module (colocated) · **Lines:** 748 · **Directive:** `"use client"`

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Composition

**Renders:** `Button`×7 (components/ui/button.tsx), `Switch`×4 (components/ui/switch.tsx), `Loader2`×3 (lucide-react), `DropdownMenuItem`×3 (components/ui/dropdown-menu.tsx), `Input`×2 (components/ui/input.tsx), `DropdownMenu`×2 (components/ui/dropdown-menu.tsx), `DropdownMenuTrigger`×2 (components/ui/dropdown-menu.tsx), `ChevronDown`×2 (lucide-react), `DropdownMenuContent`×2 (components/ui/dropdown-menu.tsx), `Check`×2 (lucide-react), `Popover` (components/ui/popover.tsx), `PopoverTrigger` (components/ui/popover.tsx), `PopoverContent` (components/ui/popover.tsx), `Search` (lucide-react), `X` (lucide-react), `Trash2` (lucide-react), `Globe` (lucide-react), `Copy` (lucide-react), `Link` (lucide-react)

### Props

- **`NoteSharePopover`**: `noteId: string`, `noteTitle: string`, `trigger: React.ReactNode`

**Hooks used:** `useState`×15, `useEffect`×3, `useUser` (context/UserContext.tsx), `useRef`, `useCallback`

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `default (NoteSharePopover)` | component | `NoteSharePopover({ noteId, noteTitle, trigger, }: NoteSharePopoverProps)` | 61 |

## Interfaces

None detected: no endpoints, events, data access or environment reads were found.

## Dependencies

- **Internal:**
  - `components/ui/popover.tsx` — `Popover`, `PopoverContent`, `PopoverTrigger`
  - `components/ui/button.tsx` — `Button`
  - `components/ui/input.tsx` — `Input`
  - `components/ui/switch.tsx` — `Switch`
  - `components/ui/dropdown-menu.tsx` — `DropdownMenu`, `DropdownMenuContent`, `DropdownMenuItem`, `DropdownMenuTrigger`
  - `lib/api-config.ts` — `buildExternalUrl`
  - `utils/api.ts` — `authenticatedFetch`
  - `context/UserContext.tsx` — `useUser`
  - `lib/feed-api.ts` — `getTeamMembers`
  - `lib/thoughts-events.ts` — `buildNoteMemberUrl`, `buildNotePublicUrl`
- **Packages:**
  - `react` — `useState`, `useEffect`, `useRef`, `useCallback`
  - `lucide-react` — `Globe`, `Link`, `ChevronDown`, `Check`, `Trash2`, `Loader2`, …
  - `sonner` — `toast`

## Used by

- `app/(dashboard)/thoughts/components/NoteDrawer.tsx`
- `app/(dashboard)/thoughts/page.tsx`
