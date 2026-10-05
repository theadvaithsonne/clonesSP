# `app/(dashboard)/thoughts/starred/page.tsx`

> Next.js page rendered at `/thoughts/starred`.

**Kind:** Next.js page · **Lines:** 412 · **Directive:** `"use client"` · **Route:** `/thoughts/starred` (page)

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Composition

**Renders:** `Star`×2 (lucide-react), `NoteCard`×2 (app/(dashboard)/thoughts/components/NoteCard.tsx), `Search` (lucide-react), `Input` (components/ui/input.tsx), `LoadingSpinner` (app/(dashboard)/thoughts/components/LoadingSpinner.tsx), `NoteDrawer` (app/(dashboard)/thoughts/components/NoteDrawer.tsx), `VersionHistory` (app/(dashboard)/thoughts/components/VersionHistory.tsx)

**Hooks used:** `useState`×9, `useEffect`×5, `useRouter` (next/navigation)

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `default (StarredNotesPage)` | component | `StarredNotesPage()` | 20 |

## Interfaces

- **Timers / queues:** `setTimeout` at L85

## Dependencies

- **Internal:**
  - `components/ui/button.tsx` — `Button`
  - `components/ui/input.tsx` — `Input`
  - `app/(dashboard)/thoughts/types.ts` — `Note`, `NoteActions`, `UpdateNoteData`
  - `app/(dashboard)/thoughts/components/NoteCard.tsx` — `NoteCard (default)`
  - `app/(dashboard)/thoughts/components/NoteDrawer.tsx` — `NoteDrawer (default)`
  - `app/(dashboard)/thoughts/components/VersionHistory.tsx` — `VersionHistory (default)`
  - `app/(dashboard)/thoughts/components/LoadingSpinner.tsx` — `LoadingSpinner (default)`, `NotesGridSkeleton`
  - `lib/api-config.ts` — `buildExternalUrl`
  - `utils/api.ts` — `authenticatedFetch`
- **Packages:**
  - `react` — `useState`, `useEffect`
  - `next` — `useRouter`
  - `lucide-react` — `Star`, `Search`
  - `sonner` — `toast`

## Used by

- `components/dashboard/inlineApps/thoughts/ThoughtsApp.tsx`

Entry: reached by the Next.js router at `/thoughts/starred` (page).
