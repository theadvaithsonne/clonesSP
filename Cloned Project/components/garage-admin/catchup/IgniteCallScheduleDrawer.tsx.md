# `components/garage-admin/catchup/IgniteCallScheduleDrawer.tsx`

> Schedule an Ignite call — the NetworkChains catch-up drawer, ported.

**Kind:** React component · **Lines:** 751 · **Directive:** `"use client"`

<!-- docgen:auto -->

## Purpose
Schedule an Ignite call — the NetworkChains catch-up drawer, ported.

This is deliberately the SAME UI as `schedule-catch-up-drawer.tsx` in the
NetworkChains web app: same right-side shell, same rounded Card of icon rows,
same push-screen navigation for timezone / date / start / end, same #FFC200
accent and confirm button. Operators move between the two products, so the
scheduling surface should not feel like a different app.

Two things differ, both because of who is scheduling:
  1. The host is the affiliate's ASSIGNED support agent, shown read-only —
     not the logged-in user. There is no picker (see ignite-call.tsx).
  2. It posts through the Garage admin API rather than straight to
     NetworkChains, so the call is created on the agent's NC account and
     linked to the affiliate in one step.
The Google Calendar row is omitted: choosing a calendar needs the agent's own
Google account, which the admin panel has no access to. The mirror still […]

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Composition

**Renders:** `Card`×8 (local), `NavRow`×4 (local), `Label`×4 (local), `ChevronRight`×4 (lucide-react), `RowShell`×3 (local), `AnimatePresence`×2 (framer-motion), `ChevronLeft`×2 (lucide-react), `Loader2`×2 (lucide-react), `InputRow`×2 (local), `TimeView`×2 (local), `X` (lucide-react), `Check` (lucide-react), `StaticRow` (local), `ParticipantsIcon` (components/garage-admin/catchup/row-icons.tsx), `TitleIcon` (components/garage-admin/catchup/row-icons.tsx), `TimezoneIcon` (components/garage-admin/catchup/row-icons.tsx), `DateIcon` (components/garage-admin/catchup/row-icons.tsx), `StartTimeIcon` (components/garage-admin/catchup/row-icons.tsx), `EndTimeIcon` (components/garage-admin/catchup/row-icons.tsx), `DescriptionIcon` (components/garage-admin/catchup/row-icons.tsx), `CalendarDays` (lucide-react), `ExistingView` (local), `TimezoneView` (local), `DateView` (local), `SearchableSelect` (components/ui/searchable-select.tsx)

### Props

- **`IgniteCallScheduleDrawer`**: `subject: IgniteCallRow | null`, `onClose: () => void`, `onSaved: (userId: string, call: IgniteCallSummary) => void`

**Hooks used:** `useState`×12, `useMemo`×4, `useEffect`×2

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `IgniteCallScheduleDrawer` | component | `IgniteCallScheduleDrawer({ subject, onClose, onSaved, }: { subject: IgniteCallRow \| …)` | 108 |

## Interfaces

None detected: no endpoints, events, data access or environment reads were found.

## Dependencies

- **Internal:**
  - `lib/utils.ts` — `cn`
  - `components/ui/searchable-select.tsx` — `SearchableSelect`, `SearchableOption`
  - `components/garage-admin/catchup/timezones.ts` — `TIMEZONES`, `canonicalTz`, `durationMinutesBetween`, `zonedWallClockToUtc`
  - `components/garage-admin/catchup/row-icons.tsx` — `TitleIcon`, `TimezoneIcon`, `DateIcon`, `StartTimeIcon`, `EndTimeIcon`, `DescriptionIcon`, `ParticipantsIcon`
  - `lib/admin-api/ignite-call.ts` — `attachIgniteCall`, `listAdminCatchups`, `AdminCatchup`, `IgniteCallSummary`
  - `components/garage-admin/ignite-call.tsx` — `IgniteCallRow`, `(types only)`
- **Packages:**
  - `react` — `useEffect`, `useMemo`, `useState`
  - `date-fns` — `format`, `parse`, `addMonths`, `subMonths`, `startOfMonth`, `endOfMonth`, …
  - `lucide-react` — `X`, `ChevronLeft`, `ChevronRight`, `Check`, `Loader2`, `CalendarDays`
  - `sonner` — `toast`
  - `framer-motion` — `motion`, `AnimatePresence`

## Used by

- `app/garage-admin/(admin-dashboard)/one-time-affiliates/page.tsx`
