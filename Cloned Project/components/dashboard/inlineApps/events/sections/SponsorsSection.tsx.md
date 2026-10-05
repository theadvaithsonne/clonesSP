# `components/dashboard/inlineApps/events/sections/SponsorsSection.tsx`

> React component `SponsorsSection`.

**Kind:** React component · **Lines:** 333 · **Directive:** `"use client"`

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Composition

**Renders:** `Button`×3 (components/dashboard/inlineApps/events/ui.tsx), `TextInput`×3 (components/dashboard/inlineApps/events/ui.tsx), `Loader2`×2 (lucide-react), `EmptyState` (components/dashboard/inlineApps/events/ui.tsx), `Building2` (lucide-react), `Plus` (lucide-react), `Card` (components/dashboard/inlineApps/events/ui.tsx), `Trash2` (lucide-react), `Modal` (components/dashboard/inlineApps/events/ui.tsx), `Label` (components/dashboard/inlineApps/events/ui.tsx), `Upload` (lucide-react)

### Props

- **`SponsorsSection`**: `eventId: string`

**Hooks used:** `useState`×7, `useConfirm` (components/dashboard/inlineApps/events/ui.tsx), `useRef`, `useCallback`, `useEffect`, `useMemo`, `useConsoleAction` (components/dashboard/inlineApps/events/ui.tsx)

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `default (SponsorsSection)` | component | `SponsorsSection({ eventId }: { eventId: string })` | 50 |

## Interfaces

None detected: no endpoints, events, data access or environment reads were found.

## Dependencies

- **Internal:**
  - `components/dashboard/inlineApps/events/ui.tsx` — `Button`, `Card`, `EmptyState`, `Label`, `Modal`, `TextInput`, `useConfirm`, `useConsoleAction`
  - `components/dashboard/inlineApps/events/api.ts` — `createSponsor`, `deleteSponsor`, `listSponsors`, `updateSponsor`, `uploadEventImage`
  - `components/dashboard/inlineApps/events/types.ts` — `EventSponsor`, `SponsorTier`, `(types only)`
- **Packages:**
  - `react` — `useCallback`, `useEffect`, `useMemo`, `useRef`, `useState`
  - `lucide-react` — `Building2`, `Loader2`, `Plus`, `Trash2`, `Upload`
  - `sonner` — `toast`

## Used by

- `components/dashboard/inlineApps/events/EventConsole.tsx`
