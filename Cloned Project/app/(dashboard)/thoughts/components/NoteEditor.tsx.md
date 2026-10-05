# `app/(dashboard)/thoughts/components/NoteEditor.tsx`

> React component `NoteEditor`.

**Kind:** Next.js app-directory module (colocated) · **Lines:** 230 · **Directive:** `"use client"`

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Composition

**Renders:** `Button`×4 (components/ui/button.tsx), `Input`×2 (components/ui/input.tsx), `Dialog` (components/ui/dialog.tsx), `DialogContent` (components/ui/dialog.tsx), `DialogHeader` (components/ui/dialog.tsx), `DialogTitle` (components/ui/dialog.tsx), `Textarea` (components/ui/textarea.tsx), `Badge` (components/ui/badge.tsx), `X` (lucide-react), `Tag` (lucide-react), `Plus` (lucide-react), `ColorPicker` (app/(dashboard)/thoughts/components/ColorPicker.tsx)

### Props

- **`NoteEditor`**: `isOpen: boolean`, `onClose: () => void`, `onSave: (data: CreateNoteData | UpdateNoteData) => void`, `note?: Note`, `mode?: "create" | "edit"`

**Hooks used:** `useState`×6, `useEffect`

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `default (NoteEditor)` | component | `NoteEditor({ isOpen, onClose, onSave, note, mode = note ? "edit" : "cr…)` | 26 |

## Interfaces

None detected: no endpoints, events, data access or environment reads were found.

## Dependencies

- **Internal:**
  - `components/ui/button.tsx` — `Button`
  - `components/ui/input.tsx` — `Input`
  - `components/ui/textarea.tsx` — `Textarea`
  - `components/ui/dialog.tsx` — `Dialog`, `DialogContent`, `DialogHeader`, `DialogTitle`
  - `components/ui/badge.tsx` — `Badge`
  - `app/(dashboard)/thoughts/types.ts` — `Note`, `CreateNoteData`, `UpdateNoteData`, `NOTE_COLORS`
  - `app/(dashboard)/thoughts/components/ColorPicker.tsx` — `ColorPicker (default)`
- **Packages:**
  - `react` — `useState`, `useEffect`
  - `lucide-react` — `X`, `Tag`, `Plus`

## Used by

- `app/(dashboard)/thoughts/recovery/page.tsx`
