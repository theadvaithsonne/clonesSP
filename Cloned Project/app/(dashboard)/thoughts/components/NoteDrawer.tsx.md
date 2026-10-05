# `app/(dashboard)/thoughts/components/NoteDrawer.tsx`

> React component `NoteDrawer`.

**Kind:** Next.js app-directory module (colocated) · **Lines:** 2309 · **Directive:** `"use client"`

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Composition

**Renders:** `RefreshCw`×9 (lucide-react), `Button`×9 (components/ui/button.tsx), `ChevronRight`×6 (lucide-react), `List`×3 (lucide-react), `Palette`×3 (lucide-react), `DragHandleMenu`×3 (@blocknote/react), `FileText`×3 (lucide-react), `TableIcon`×3 (lucide-react), `Type`×2 (lucide-react), `Heading1`×2 (lucide-react), `Heading2`×2 (lucide-react), `Heading3`×2 (lucide-react), `ListOrdered`×2 (lucide-react), `CheckSquare`×2 (lucide-react), `Quote`×2 (lucide-react), `Trash2`×2 (lucide-react), `ChevronLeft`×2 (lucide-react), `Sparkles`×2 (lucide-react), `Paintbrush`×2 (lucide-react), `BarChart3`×2 (lucide-react), `Pin`×2 (lucide-react), `DropdownMenuItem`×2 (components/ui/dropdown-menu.tsx), `Loader2`×2 (lucide-react), `BlockNoteView`×2 (@blocknote/mantine), `AlertDialog`×2 (components/ui/alert-dialog.tsx), `AlertDialogContent`×2 (components/ui/alert-dialog.tsx), `AlertDialogHeader`×2 (components/ui/alert-dialog.tsx), `AlertDialogTitle`×2 (components/ui/alert-dialog.tsx), `AlertDialogDescription`×2 (components/ui/alert-dialog.tsx), `AlertDialogFooter`×2 (components/ui/alert-dialog.tsx), `AlertDialogCancel`×2 (components/ui/alert-dialog.tsx), `Copy` (lucide-react), `SideMenu` (@blocknote/react), `Popover` (components/ui/popover.tsx), `PopoverTrigger` (components/ui/popover.tsx), `Plus` (lucide-react), `PopoverContent` (components/ui/popover.tsx), `CommandsMenu` (app/(dashboard)/thoughts/components/CommandsMenu.tsx), `DragHandleButton` (@blocknote/react), `CustomDragHandleMenu` (local), … +38 more

### Props

- **`NoteDrawer`**: `isOpen: boolean`, `onClose: () => void`, `noteId?: string | null`, `initialEditMode?: boolean`, `onSave?: (note: Note) => void`, `onDelete?: (noteId: string) => void`, `onArchive?: (noteId: string) => void`

**Hooks used:** `useState`×20, `useEffect`×6, `useRef`×2, `useCreateBlockNote` (@blocknote/react)

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `default (NoteDrawer)` | component | `NoteDrawer({ isOpen, onClose, noteId, initialEditMode = false, onSave,…)` | 617 |

## Interfaces

- **Timers / queues:** `setTimeout` at L1448, L1483, L1519, L1656
- **External hosts mentioned in the code:** `www.youtube.com`

## Dependencies

- **Internal:**
  - `components/ui/button.tsx` — `Button`
  - `components/ui/sheet.tsx` — `Sheet`, `SheetContent`, `SheetHeader`, `SheetTitle`
  - `components/ui/alert-dialog.tsx` — `AlertDialog`, `AlertDialogAction`, `AlertDialogCancel`, `AlertDialogContent`, `AlertDialogDescription`, `AlertDialogFooter`, `AlertDialogHeader`, `AlertDialogTitle`
  - `components/ui/dropdown-menu.tsx` — `DropdownMenu`, `DropdownMenuContent`, `DropdownMenuItem`, `DropdownMenuSeparator`, `DropdownMenuTrigger`
  - `components/ui/popover.tsx` — `Popover`, `PopoverContent`, `PopoverTrigger`
  - `app/(dashboard)/thoughts/components/CommandsMenu.tsx` — `CommandsMenu (default)`
  - `lib/api-config.ts` — `buildExternalUrl`
  - `utils/api.ts` — `authenticatedFetch`
  - `lib/thoughts-events.ts` — `dedupeNoteBreadcrumbs`, `patchNoteParentId`
  - `app/(dashboard)/thoughts/types.ts` — `Note`, `NOTE_COLORS`, `NoteBreadcrumbItem`
  - `app/(dashboard)/thoughts/components/NoteBreadcrumbs.tsx` — `NoteBreadcrumbs (default)`
  - `app/(dashboard)/thoughts/components/NotePageHeader.tsx` — `NotePageHeader (default)`
  - `app/(dashboard)/thoughts/components/NoteSharePopover.tsx` — `NoteSharePopover (default)`
  - `app/(dashboard)/thoughts/components/NotePageComments.tsx` — `NotePageComments (default)`
  - `app/(dashboard)/thoughts/types.ts` — `NotePageComment`, `(types only)`
  - `utils/uploadthing.ts` — `uploadFiles`
  - `app/(dashboard)/thoughts/components/blocks/index.ts` — `coverPhotoBlock`, `documentListBlock`, `calendarViewBlock`, `timelineViewBlock`, `chartViewBlock`, `linkedViewBlock`, `tableViewBlock`, `boardViewBlock`, … +19
- **Packages:**
  - `react` — `useState`, `useEffect`, `useRef`
  - `lucide-react` — `Star`, `Archive`, `Trash2`, `Pin`, `MoreVertical`, `ArchiveX`, …
  - `sonner` — `toast`
  - `@blocknote/core` — `filterSuggestionItems`, `insertOrUpdateBlock as _insertOrUpdateBlock`, `defaultBlockSpecs`, `BlockNoteSchema`
  - `@blocknote/mantine` — `BlockNoteView`
  - `@blocknote/react` — `useCreateBlockNote`, `getDefaultReactSlashMenuItems`, `SuggestionMenuController`, `SideMenuController`, `SideMenu`, `DragHandleButton`, …

## Used by

- `app/(dashboard)/thoughts/archive/page.tsx`
- `app/(dashboard)/thoughts/starred/page.tsx`
- `app/(dashboard)/thoughts/trash/page.tsx`

## Notes

- Large file (2309 lines) — read it by section; line numbers above point into it.
