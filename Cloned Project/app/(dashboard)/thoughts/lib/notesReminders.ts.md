# `app/(dashboard)/thoughts/lib/notesReminders.ts`

> Shared notes-reminder storage + ringtone helper.

**Kind:** Next.js app-directory module (colocated) · **Lines:** 79 · **Directive:** `"use client"`

<!-- docgen:auto -->

## Purpose
Shared notes-reminder storage + ringtone helper.
Reminders are checked globally from the thoughts page so they still fire
when the user isn't looking at the block that created them.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `NOTES_REMINDER_STORAGE_KEY` | const | `= "notes-reminders-v2"` — Shared notes-reminder storage + ringtone helper. | 9 |
| `NOTES_REMINDER_EVENT` | const | `= "notes:reminder-fired"` | 10 |
| `StoredNoteReminder` | interface |  | 12 |
| `getStoredNoteReminders` | function | `getStoredNoteReminders(): Record<string, StoredNoteReminder>` | 24 |
| `upsertNoteReminder` | function | `upsertNoteReminder(reminder: StoredNoteReminder)` | 33 |
| `markNoteReminderTriggered` | function | `markNoteReminderTriggered(blockId: string)` | 39 |
| `removeNoteReminder` | function | `removeNoteReminder(blockId: string)` | 47 |
| `playReminderRingtone` | function | `playReminderRingtone()` — Same ringtone used for workspace knocks. | 54 |
| `getActiveNoteTitleFromDom` | function | `getActiveNoteTitleFromDom(): string` | 65 |
| `getActiveNoteIdFromDom` | function | `getActiveNoteIdFromDom(): string` | 74 |

## Interfaces

None detected: no endpoints, events, data access or environment reads were found.

## Dependencies

- **Internal:** none
- **Packages:** none

## Used by

- `app/(dashboard)/thoughts/components/NotesReminderListener.tsx`
- `app/(dashboard)/thoughts/components/blocks/ReminderBlock.tsx`
