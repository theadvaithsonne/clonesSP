# `app/garage-admin/(admin-dashboard)/networkchains/meet/page.tsx`

> Next.js page rendered at `/garage-admin/networkchains/meet`.

**Kind:** Next.js page · **Lines:** 1100 · **Directive:** `"use client"` · **Route:** `/garage-admin/networkchains/meet` (page)

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Composition

**Renders:** `StatCard`×6 (local), `Monitor`×5 (lucide-react), `Film`×4 (lucide-react), `Users`×3 (lucide-react), `Loader2`×2 (lucide-react), `Zap`×2 (lucide-react), `Video`×2 (lucide-react), `Clock`×2 (lucide-react), `TrendingUp`×2 (lucide-react), `CalendarIcon`×2 (lucide-react), `UserCheck` (lucide-react)

**Hooks used:** `useState`×7, `useEffect`×3, `useRef`, `useMemo`

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `default (MeetAnalyticsPage)` | component | `MeetAnalyticsPage()` | 56 |

## Interfaces

- **External HTTP calls:**
  - `GET lk.garage.app/api/recordings/list` (L100)
- **Environment variables (`process.env`):** `NEXT_PUBLIC_LIVEKIT_URL`
- **External hosts mentioned in the code:** `lk.garage.app`

## Dependencies

- **Internal:**
  - `lib/nc-admin-api/admin.ts` — `getMeetAnalytics`, `AdminUnauthorizedError`, `MeetAnalyticsData`, `MeetSession`
  - `lib/nc-admin-api/auth.ts` — `ensureNcAdminToken`
- **Packages:**
  - `react` — `useEffect`, `useMemo`, `useRef`, `useState`
  - `lucide-react` — `Video`, `Users`, `Clock`, `Film`, `TrendingUp`, `Calendar as CalendarIcon`, …

## Used by

Entry: reached by the Next.js router at `/garage-admin/networkchains/meet` (page).
