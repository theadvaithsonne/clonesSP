# `app/(dashboard)/thoughts/components/NotesReminderListener.tsx`

> React component `NotesReminderListener`.

**Kind:** Next.js app-directory module (colocated) · **Lines:** 135 · **Directive:** `"use client"`

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Composition

**Renders:** `AnimatePresence` (framer-motion), `AlarmClock` (lucide-react), `X` (lucide-react)

### Props

- **`NotesReminderListener`**: `onOpenNote?: (noteId: string) => void`

**Hooks used:** `useRef`×2, `useState`, `useEffect`

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `default (NotesReminderListener)` | component | `NotesReminderListener({ onOpenNote, }: { onOpenNote?: (noteId: string) => void; })` — Polls localStorage for due note reminders and rings like a knock, with an in-app card: "You have a reminder for {note title}". | 18 |

## Interfaces

None detected: no endpoints, events, data access or environment reads were found.

## Dependencies

- **Internal:**
  - `app/(dashboard)/thoughts/lib/notesReminders.ts` — `NOTES_REMINDER_EVENT`, `getStoredNoteReminders`, `markNoteReminderTriggered`, `playReminderRingtone`, `StoredNoteReminder`
- **Packages:**
  - `react` — `useEffect`, `useRef`, `useState`
  - `framer-motion` — `AnimatePresence`, `motion`
  - `lucide-react` — `AlarmClock`, `X`

## Used by

- `app/(dashboard)/thoughts/page.tsx`
