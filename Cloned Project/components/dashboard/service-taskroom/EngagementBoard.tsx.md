# `components/dashboard/service-taskroom/EngagementBoard.tsx`

> The "Taskroom Board" tab inside a service engagement.

**Kind:** React component · **Lines:** 441 · **Directive:** `"use client"`

<!-- docgen:auto -->

## Purpose
The "Taskroom Board" tab inside a service engagement.

Everything rendered here arrives pre-filtered from
`GET /services/opt-ins/:optInId/board`: internal columns and internal cards
are removed server-side, and the timelog fields are only present when the
founder switched that permission on. The client is never handed a roomId, so
this view cannot be used to reach Taskroom directly.

Read-only by design. Clients are `observer` on the underlying room; drag and
edit stay in the full Taskroom workspace, which the founder reaches through
"Take to Taskroom".

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Composition

**Renders:** `Loader2`×3 (lucide-react), `TeamAvatar`×2 (local), `AlertCircle` (lucide-react), `RefreshCw` (lucide-react), `Activity` (lucide-react), `EngagementActivityPanel` (components/dashboard/service-taskroom/EngagementActivityPanel.tsx), `CheckCircle2` (lucide-react), `ListChecks` (lucide-react), `Clock` (lucide-react), `Timer` (lucide-react)

### Props

- **`EngagementBoard`**: `optInId: string`, `isFounder?: boolean`, `onOpenTaskroom?: (handles: { roomId?: string; spaceId?: string; works…`

**Hooks used:** `useState`×5, `useEffect`×2, `useCallback`

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `EngagementBoard` | component | `EngagementBoard({ optInId, /** Founders get the retry control and the room …)` | 114 |

## Interfaces

- **Timers / queues:** `setTimeout` at L157

## Dependencies

- **Internal:**
  - `lib/utils.ts` — `cn`
  - `lib/feed-api.ts` — `getEngagementBoard`, `provisionEngagementTaskroom`, `EngagementBoard as EngagementBoardData`, `EngagementTeamMember`
  - `components/dashboard/service-taskroom/EngagementActivityPanel.tsx` — `EngagementActivityPanel`
- **Packages:**
  - `react` — `useCallback`, `useEffect`, `useState`
  - `lucide-react` — `Activity`, `AlertCircle`, `CheckCircle2`, `Clock`, `ListChecks`, `Loader2`, …
  - `sonner` — `toast`

## Used by

No other file imports this one and it has no automatic entry point — it appears unused (or is loaded dynamically by a path the import graph cannot see).
