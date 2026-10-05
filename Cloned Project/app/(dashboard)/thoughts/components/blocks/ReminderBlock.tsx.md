# `app/(dashboard)/thoughts/components/blocks/ReminderBlock.tsx`

> Module exporting `reminderBlock`.

**Kind:** Next.js app-directory module (colocated) · **Lines:** 327 · **Directive:** `"use client"`

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Composition

**Renders:** `AlarmClock`×2 (lucide-react), `Check` (lucide-react), `ChevronDown` (lucide-react), `CalendarUI` (components/ui/calendar.tsx), `ReminderRenderer` (local)

**Hooks used:** `useState`×6, `useEffect`×3, `useCallback`×2, `useRef`

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `reminderBlock` | const | `= createReactBlockSpec( { type: "reminder" as const, propSchema: { reminderDate: { default: "", typ…` | 311 |

## Interfaces

None detected: no endpoints, events, data access or environment reads were found.

## Dependencies

- **Internal:**
  - `components/ui/calendar.tsx` — `Calendar as CalendarUI`
  - `app/(dashboard)/thoughts/lib/notesReminders.ts` — `getActiveNoteIdFromDom`, `getActiveNoteTitleFromDom`, `upsertNoteReminder`
- **Packages:**
  - `react` — `useState`, `useRef`, `useEffect`, `useCallback`
  - `lucide-react` — `AlarmClock`, `ChevronDown`, `Check`
  - `@blocknote/react` — `createReactBlockSpec`
  - `sonner` — `toast`

## Used by

- `app/(dashboard)/thoughts/components/blocks/index.ts`
