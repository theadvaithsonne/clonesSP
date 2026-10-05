# `app/(dashboard)/thoughts/recovery/page.tsx`

> Next.js page rendered at `/thoughts/recovery`.

**Kind:** Next.js page · **Lines:** 366 · **Directive:** `"use client"` · **Route:** `/thoughts/recovery` (page)

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Composition

**Renders:** `History`×2 (lucide-react), `AlertTriangle`×2 (lucide-react), `NoteCard`×2 (app/(dashboard)/thoughts/components/NoteCard.tsx), `Clock`×2 (lucide-react), `Button`×2 (components/ui/button.tsx), `RotateCcw`×2 (lucide-react), `Search` (lucide-react), `Input` (components/ui/input.tsx), `LoadingSpinner` (app/(dashboard)/thoughts/components/LoadingSpinner.tsx), `NoteViewer` (app/(dashboard)/thoughts/components/NoteViewer.tsx)

**Hooks used:** `useState`×6, `useEffect`×4

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `default (RecoveryNotesPage)` | component | `RecoveryNotesPage()` | 39 |

## Interfaces

- **Timers / queues:** `setTimeout` at L73

## Dependencies

- **Internal:**
  - `components/ui/button.tsx` — `Button`
  - `components/ui/input.tsx` — `Input`
  - `lib/api-config.ts` — `buildExternalUrl`
  - `utils/api.ts` — `authenticatedFetch`
  - `app/(dashboard)/thoughts/types.ts` — `Note`, `NoteActions`, `UpdateNoteData`
  - `app/(dashboard)/thoughts/components/NoteCard.tsx` — `NoteCard (default)`
  - `app/(dashboard)/thoughts/components/NoteEditor.tsx` — `NoteEditor (default)`
  - `app/(dashboard)/thoughts/components/NoteViewer.tsx` — `NoteViewer (default)`
  - `app/(dashboard)/thoughts/components/LoadingSpinner.tsx` — `LoadingSpinner (default)`, `NotesGridSkeleton`
  - `components/ui/alert-dialog.tsx` — `AlertDialog`, `AlertDialogAction`, `AlertDialogCancel`, `AlertDialogContent`, `AlertDialogDescription`, `AlertDialogFooter`, `AlertDialogHeader`, `AlertDialogTitle`, … +1
- **Packages:**
  - `react` — `useState`, `useEffect`
  - `lucide-react` — `History`, `Search`, `RotateCcw`, `AlertTriangle`, `Clock`
  - `sonner` — `toast`

## Used by

- `components/dashboard/inlineApps/thoughts/ThoughtsApp.tsx`

Entry: reached by the Next.js router at `/thoughts/recovery` (page).
