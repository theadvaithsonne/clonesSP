# `app/(dashboard)/thoughts/components/NoteViewer.tsx`

> React component `NoteViewer`.

**Kind:** Next.js app-directory module (colocated) · **Lines:** 449 · **Directive:** `"use client"`

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Composition

**Renders:** `DropdownMenuItem`×6 (components/ui/dropdown-menu.tsx), `Badge`×5 (components/ui/badge.tsx), `Button`×4 (components/ui/button.tsx), `Trash2`×3 (lucide-react), `Pin`×2 (lucide-react), `Star`×2 (lucide-react), `Palette`×2 (lucide-react), `DropdownMenuSeparator`×2 (components/ui/dropdown-menu.tsx), `Archive`×2 (lucide-react), `Calendar`×2 (lucide-react), `Dialog` (components/ui/dialog.tsx), `DialogContent` (components/ui/dialog.tsx), `DialogHeader` (components/ui/dialog.tsx), `DialogTitle` (components/ui/dialog.tsx), `PinOff` (lucide-react), `DropdownMenu` (components/ui/dropdown-menu.tsx), `DropdownMenuTrigger` (components/ui/dropdown-menu.tsx), `MoreVertical` (lucide-react), `DropdownMenuContent` (components/ui/dropdown-menu.tsx), `Edit3` (lucide-react), `RotateCcw` (lucide-react), `ArchiveRestore` (lucide-react), `X` (lucide-react), `BlockNoteView` (@blocknote/mantine), `Tag` (lucide-react), `ColorPicker` (app/(dashboard)/thoughts/components/ColorPicker.tsx)

### Props

- **`NoteViewer`**: `isOpen: boolean`, `onClose: () => void`, `note: Note | null`, `actions: NoteActions`, `showArchiveActions?: boolean`, `showTrashActions?: boolean`

**Hooks used:** `useEffect`×2, `useCreateBlockNote` (@blocknote/react)

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `default (NoteViewer)` | component | `NoteViewer({ isOpen, onClose, note, actions, showArchiveActions = fals…)` | 77 |

## Interfaces

None detected: no endpoints, events, data access or environment reads were found.

## Dependencies

- **Internal:**
  - `components/ui/button.tsx` — `Button`
  - `components/ui/badge.tsx` — `Badge`
  - `components/ui/dialog.tsx` — `Dialog`, `DialogContent`, `DialogHeader`, `DialogTitle`
  - `components/ui/dropdown-menu.tsx` — `DropdownMenu`, `DropdownMenuContent`, `DropdownMenuItem`, `DropdownMenuSeparator`, `DropdownMenuTrigger`
  - `lib/utils.ts` — `cn`
  - `app/(dashboard)/thoughts/types.ts` — `Note`, `NoteActions`, `getColorClass`, `formatDate`, `NOTE_COLORS`
  - `app/(dashboard)/thoughts/components/ColorPicker.tsx` — `ColorPicker (default)`
  - `app/(dashboard)/thoughts/components/blocks/index.ts` — `coverPhotoBlock`, `documentListBlock`, `calendarViewBlock`, `timelineViewBlock`, `chartViewBlock`, `linkedViewBlock`, `tableViewBlock`, `boardViewBlock`, … +15
- **Packages:**
  - `react` — `useEffect`
  - `lucide-react` — `Star`, `Archive`, `Trash2`, `MoreVertical`, `Edit3`, `Palette`, …
  - `@blocknote/react` — `useCreateBlockNote`
  - `@blocknote/mantine` — `BlockNoteView`
  - `@blocknote/core` — `BlockNoteSchema`, `defaultBlockSpecs`

## Used by

- `app/(dashboard)/thoughts/recovery/page.tsx`
