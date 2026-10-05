# `app/(dashboard)/thoughts/trash/page.tsx`

> Next.js page rendered at `/thoughts/trash`.

**Kind:** Next.js page · **Lines:** 451 · **Directive:** `"use client"` · **Route:** `/thoughts/trash` (page)

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Composition

**Renders:** `Trash2`×2 (lucide-react), `AlertTriangle`×2 (lucide-react), `NoteCard`×2 (app/(dashboard)/thoughts/components/NoteCard.tsx), `Search` (lucide-react), `Input` (components/ui/input.tsx), `AlertDialog` (components/ui/alert-dialog.tsx), `AlertDialogTrigger` (components/ui/alert-dialog.tsx), `Button` (components/ui/button.tsx), `Trash` (lucide-react), `AlertDialogContent` (components/ui/alert-dialog.tsx), `AlertDialogHeader` (components/ui/alert-dialog.tsx), `AlertDialogTitle` (components/ui/alert-dialog.tsx), `AlertDialogDescription` (components/ui/alert-dialog.tsx), `AlertDialogFooter` (components/ui/alert-dialog.tsx), `AlertDialogCancel` (components/ui/alert-dialog.tsx), `AlertDialogAction` (components/ui/alert-dialog.tsx), `LoadingSpinner` (app/(dashboard)/thoughts/components/LoadingSpinner.tsx), `NoteDrawer` (app/(dashboard)/thoughts/components/NoteDrawer.tsx)

**Hooks used:** `useState`×7, `useEffect`×5, `useRouter` (next/navigation)

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `default (TrashNotesPage)` | component | `TrashNotesPage()` | 37 |

## Interfaces

- **Timers / queues:** `setTimeout` at L100

## Dependencies

- **Internal:**
  - `components/ui/button.tsx` — `Button`
  - `components/ui/input.tsx` — `Input`
  - `components/ui/card.tsx` — `Card`, `CardContent`
  - `lib/utils.ts` — `cn`
  - `lib/api-config.ts` — `buildExternalUrl`
  - `utils/api.ts` — `authenticatedFetch`
  - `app/(dashboard)/thoughts/types.ts` — `Note`, `NoteActions`, `UpdateNoteData`
  - `app/(dashboard)/thoughts/components/NoteCard.tsx` — `NoteCard (default)`
  - `app/(dashboard)/thoughts/components/NoteDrawer.tsx` — `NoteDrawer (default)`
  - `app/(dashboard)/thoughts/components/LoadingSpinner.tsx` — `LoadingSpinner (default)`, `NotesGridSkeleton`
  - `components/ui/alert-dialog.tsx` — `AlertDialog`, `AlertDialogAction`, `AlertDialogCancel`, `AlertDialogContent`, `AlertDialogDescription`, `AlertDialogFooter`, `AlertDialogHeader`, `AlertDialogTitle`, … +1
- **Packages:**
  - `react` — `useState`, `useEffect`
  - `next` — `useRouter`
  - `lucide-react` — `Trash2`, `Search`, `RotateCcw`, `Trash`, `Star`, `AlertTriangle`
  - `sonner` — `toast`

## Used by

- `components/dashboard/inlineApps/thoughts/ThoughtsApp.tsx`

Entry: reached by the Next.js router at `/thoughts/trash` (page).
