# `app/garage-admin/(admin-dashboard)/networkchains/meet/live/page.tsx`

> Admin LIVE calls dashboard.

**Kind:** Next.js page · **Lines:** 1663 · **Directive:** `"use client"` · **Route:** `/garage-admin/networkchains/meet/live` (page)

<!-- docgen:auto -->

## Purpose
Admin LIVE calls dashboard.

Real-time monitoring + moderation of every ongoing LiveKit room.
Admin can mute, ban, kick, end a call, toggle host access-control,
start/stop recording, broadcast a system message — all without
joining the call.

Motivating incident: a rogue host muted everyone and blocked others
from unmuting themselves. An out-of-band super-admin now has the
override.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Composition

**Renders:** `Loader2`×10 (lucide-react), `Circle`×5 (lucide-react), `Radio`×4 (lucide-react), `StatCard`×4 (local), `Users`×3 (lucide-react), `Calendar`×3 (lucide-react), `TabBtn`×3 (local), `History`×3 (lucide-react), `EmptyState`×3 (local), `DrawerTabBtn`×3 (local), `ControlBlock`×3 (local), `Clock`×2 (lucide-react), `Video`×2 (lucide-react), `Film`×2 (lucide-react), `VolumeX`×2 (lucide-react), `Toggle`×2 (local), `IconAction`×2 (local), `CheckCircle2` (lucide-react), `AlertCircle` (lucide-react), `ShieldAlert` (lucide-react), `RefreshCw` (lucide-react), `ArrowUpDown` (lucide-react), `RoomCard` (local), `ScheduledTable` (local), `EndedTable` (local), `RoomDetailDrawer` (local), `ToastStack` (local), `KindBadge` (local), `X` (lucide-react), `Building2` (lucide-react), `UserIcon` (lucide-react), `Settings2` (lucide-react), `ParticipantRow` (local), `HistoricalParticipantRow` (local), `ArtifactsPanel` (local), `Send` (lucide-react), `PhoneOff` (lucide-react), `Volume2` (lucide-react), `Bot` (lucide-react), `Monitor` (lucide-react), … +7 more

**Hooks used:** `useState`×16, `useRef`×8, `useEffect`×4, `useCallback`×3, `useSecondTick`×2 (local), `useAdminSearch` (components/garage-admin/admin-search.tsx), `useToasts` (local), `useMemo`, `useAdminAccess` (components/garage-admin/use-admin-access.ts)

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `default (AdminLiveCallsPage)` | component | `AdminLiveCallsPage()` | 175 |

## Interfaces

None detected: no endpoints, events, data access or environment reads were found.

## Dependencies

- **Internal:**
  - `lib/nc-admin-api/admin.ts` — `listLiveRooms`, `getLiveRoom`, `getEndedRoom`, `getAdminRecordingUrl`, `muteLiveParticipant`, `kickLiveParticipant`, `endLiveRoom`, `listScheduledMeets`, … +15
  - `lib/nc-admin-api/auth.ts` — `ensureNcAdminToken`
  - `components/garage-admin/use-admin-access.ts` — `useAdminAccess`
  - `components/garage-admin/admin-search.tsx` — `useAdminSearch`
- **Packages:**
  - `react` — `useCallback`, `useEffect`, `useMemo`, `useRef`, `useState`
  - `lucide-react` — `Radio`, `Users`, `Mic`, `MicOff`, `Video`, `VideoOff`, …

## Used by

Entry: reached by the Next.js router at `/garage-admin/networkchains/meet/live` (page).

## Notes

- Large file (1663 lines) — read it by section; line numbers above point into it.
