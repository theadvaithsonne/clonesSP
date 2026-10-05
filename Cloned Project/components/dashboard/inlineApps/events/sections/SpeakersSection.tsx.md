# `components/dashboard/inlineApps/events/sections/SpeakersSection.tsx`

> React component `SpeakersSection`.

**Kind:** React component · **Lines:** 563 · **Directive:** `"use client"`

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Composition

**Renders:** `TextInput`×6 (components/dashboard/inlineApps/events/ui.tsx), `Loader2`×3 (lucide-react), `Button`×3 (components/dashboard/inlineApps/events/ui.tsx), `EmptyState` (components/dashboard/inlineApps/events/ui.tsx), `Mic2` (lucide-react), `Plus` (lucide-react), `Card` (components/dashboard/inlineApps/events/ui.tsx), `Star` (lucide-react), `Trash2` (lucide-react), `Modal` (components/dashboard/inlineApps/events/ui.tsx), `Search` (lucide-react), `Users` (lucide-react), `Label` (components/dashboard/inlineApps/events/ui.tsx), `Upload` (lucide-react), `TextArea` (components/dashboard/inlineApps/events/ui.tsx), `Toggle` (components/dashboard/inlineApps/events/ui.tsx)

### Props

- **`SpeakersSection`**: `eventId: string`

**Hooks used:** `useState`×12, `useCallback`×2, `useConfirm` (components/dashboard/inlineApps/events/ui.tsx), `useRef`, `useEffect`, `useConsoleAction` (components/dashboard/inlineApps/events/ui.tsx)

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `default (SpeakersSection)` | component | `SpeakersSection({ eventId }: { eventId: string })` | 64 |

## Interfaces

None detected: no endpoints, events, data access or environment reads were found.

## Dependencies

- **Internal:**
  - `components/dashboard/inlineApps/events/ui.tsx` — `Button`, `Card`, `EmptyState`, `GOLD`, `Label`, `Modal`, `TextArea`, `TextInput`, … +3
  - `lib/auth.ts` — `getOrgId`
  - `lib/feed-api.ts` — `getTeamMembers`, `TeamMember`
  - `components/dashboard/inlineApps/events/api.ts` — `uploadEventImage`
  - `components/dashboard/inlineApps/events/api.ts` — `createSpeaker`, `deleteSpeaker`, `listSessions`, `listSpeakers`, `updateSpeaker`
  - `components/dashboard/inlineApps/events/types.ts` — `AgendaSession`, `EventSpeaker`, `(types only)`
- **Packages:**
  - `react` — `useCallback`, `useEffect`, `useRef`, `useState`
  - `lucide-react` — `Loader2`, `Mic2`, `Plus`, `Search`, `Star`, `Trash2`, …
  - `sonner` — `toast`

## Used by

- `components/dashboard/inlineApps/events/EventConsole.tsx`
