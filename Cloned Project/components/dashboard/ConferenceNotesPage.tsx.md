# `components/dashboard/ConferenceNotesPage.tsx`

> React component `ConferenceNotesPage`.

**Kind:** React component · **Lines:** 361 · **Directive:** `"use client"`

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Composition

**Renders:** `Loader2`×6 (lucide-react), `CheckSquare`×2 (lucide-react), `NoteDetail` (local), `NotesList` (local), `FileText` (lucide-react), `Mic` (lucide-react), `StatusBadge` (local), `ArrowRight` (lucide-react), `ArrowLeft` (lucide-react), `Users` (lucide-react), `Download` (lucide-react), `Send` (lucide-react), `Lightbulb` (lucide-react), `HelpCircle` (lucide-react)

**Hooks used:** `useState`×10, `useEffect`×4, `useCallback`×2

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `default (ConferenceNotesPage)` | component | `ConferenceNotesPage()` | 67 |

## Interfaces

None detected: no endpoints, events, data access or environment reads were found.

## Dependencies

- **Internal:**
  - `lib/api/conference-notes.ts` — `conferenceNotesApi`, `isNoteSessionTerminal`, `ConferenceNoteSession`, `ConferenceNoteSummary`, `ConferenceNoteTranscript`, `NoteSessionStatus`
- **Packages:**
  - `react` — `useEffect`, `useState`, `useCallback`
  - `sonner` — `toast`
  - `lucide-react` — `ArrowLeft`, `ArrowRight`, `CheckSquare`, `Download`, `FileText`, `HelpCircle`, …

## Used by

- `app/(dashboard)/layout.tsx`
