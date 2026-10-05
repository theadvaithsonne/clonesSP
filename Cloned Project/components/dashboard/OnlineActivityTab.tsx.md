# `components/dashboard/OnlineActivityTab.tsx`

> React component `OnlineActivityTab`.

**Kind:** React component · **Lines:** 789 · **Directive:** `"use client"`

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Composition

**Renders:** `Button`×4 (components/ui/button.tsx), `Wifi`×3 (lucide-react), `Input`×2 (components/ui/input.tsx), `Select` (components/ui/select.tsx), `SelectTrigger` (components/ui/select.tsx), `SelectValue` (components/ui/select.tsx), `SelectContent` (components/ui/select.tsx), `SelectItem` (components/ui/select.tsx), `RefreshCw` (lucide-react), `WifiOff` (lucide-react), `Badge` (components/ui/badge.tsx), `ChevronLeft` (lucide-react), `ChevronRight` (lucide-react)

**Hooks used:** `useState`×8, `useMemo`×6, `useEffect`×3, `useCallback`

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `default (OnlineActivityTab)` | component | `OnlineActivityTab()` | 98 |

## Interfaces

- **Backend endpoints called (via `/backend`):**
  - `GET /backend/betty/online-activity?${params.toString()}` (L136)
- **Browser storage / cookies:** `garage_org_id` (localStorage: get)

## Dependencies

- **Internal:**
  - `lib/api.ts` — `api`
  - `components/ui/button.tsx` — `Button`
  - `components/ui/input.tsx` — `Input`
  - `components/ui/select.tsx` — `Select`, `SelectContent`, `SelectItem`, `SelectTrigger`, `SelectValue`
  - `components/ui/badge.tsx` — `Badge`
- **Packages:**
  - `react` — `useEffect`, `useMemo`, `useState`, `useCallback`
  - `framer-motion` — `motion`
  - `lucide-react` — `RefreshCw`, `Wifi`, `WifiOff`, `ChevronLeft`, `ChevronRight`

## Used by

- `components/dashboard/BettyDashboardPage.tsx`
