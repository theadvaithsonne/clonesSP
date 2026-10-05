# `components/garage-admin/IgniteCallDrawer.tsx`

> Everything one Ignite call produced — recordings, the note-taker transcript and its AI summary — opened from the muted "date ›" line under the status badge.

**Kind:** React component · **Lines:** 694 · **Directive:** `"use client"`

<!-- docgen:auto -->

## Purpose
Everything one Ignite call produced — recordings, the note-taker transcript
and its AI summary — opened from the muted "date ›" line under the status
badge.

Built on the NetworkChains right-panel language (see
`schedule-catch-up-drawer.tsx` in the NC web app): the same 440px right-side
sheet on #0e0e0e with a left border and a deep left shadow, the same spring
slide-in, the same circular 40px header buttons, and content grouped into
rounded-[20px] Cards of bordered rows. Section headings sit OUTSIDE the card,
small and uppercase, so a long panel stays scannable.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Composition

**Renders:** `Card`×8 (local), `Row`×7 (local), `Section`×5 (local), `Empty`×5 (local), `Loader2`×3 (lucide-react), `SubLabel`×3 (local), `X`×2 (lucide-react), `AnimatePresence` (framer-motion), `Film` (lucide-react), `Sparkles` (lucide-react), `FileText` (lucide-react), `Users` (lucide-react), `Undo2` (lucide-react), `CheckCircle2` (lucide-react), `CalendarClock` (lucide-react), `Trash2` (lucide-react), `RescheduleDialog` (local)

### Props

- **`IgniteCallDrawer`**: `userId: string | null`, `callId: string | null`, `personName: string | null`, `canEdit: boolean`, `onClose: () => void`, `onDetached: (userId: string) => void`

**Hooks used:** `useState`×11, `useEffect`×3

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `IgniteCallDrawer` | component | `IgniteCallDrawer({ userId, callId, personName, canEdit, onClose, onDetached,…)` | 67 |

## Interfaces

None detected: no endpoints, events, data access or environment reads were found.

## Dependencies

- **Internal:**
  - `lib/utils.ts` — `cn`
  - `lib/admin-api/permissions.ts` — `isSuperAdminClient`
  - `lib/admin-api/ignite-call.ts` — `getIgniteCallRelated`, `listIgniteCalls`, `detachIgniteCall`, `rescheduleIgniteCall`, `setIgniteCallCompleted`, `IGNITE_STATUS_LABEL`, `IgniteCallRelated`, `IgniteStatus`
- **Packages:**
  - `react` — `useEffect`, `useState`
  - `framer-motion` — `motion`, `AnimatePresence`
  - `lucide-react` — `X`, `Loader2`, `Trash2`, `Film`, `FileText`, `Sparkles`, …
  - `sonner` — `toast`

## Used by

- `app/garage-admin/(admin-dashboard)/one-time-affiliates/page.tsx`
