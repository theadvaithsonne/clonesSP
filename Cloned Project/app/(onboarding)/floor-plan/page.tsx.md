# `app/(onboarding)/floor-plan/page.tsx`

> Next.js page rendered at `/floor-plan`.

**Kind:** Next.js page · **Lines:** 395 · **Directive:** `"use client"` · **Route:** `/floor-plan` (page)

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Composition

**Renders:** `Button`×6 (components/ui/button.tsx), `Plus`×2 (lucide-react), `Input`×2 (components/ui/input.tsx), `Building2` (lucide-react), `Save` (lucide-react), `AnimatePresence` (framer-motion), `Card` (components/ui/card.tsx), `GripVertical` (lucide-react), `ArrowUp` (lucide-react), `ArrowDown` (lucide-react), `Minus` (lucide-react), `DeptEditor` (local), `Tag` (lucide-react)

**Hooks used:** `useState`×4, `useRouter` (next/navigation), `useEffect`, `useRef`

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `default (FloorPlanPage)` | component | `FloorPlanPage()` | 27 |

## Interfaces

- **Backend endpoints called (via `/backend`):**
  - `GET /backend/floors` (L37)
  - `POST /backend/floors/setup` (L124)
- **Timers / queues:** `setTimeout` at L326

## Dependencies

- **Internal:**
  - `lib/api.ts` — `api`
  - `lib/auth.ts` — `getToken`
  - `components/ui/button.tsx` — `Button`
  - `components/ui/input.tsx` — `Input`
  - `components/ui/card.tsx` — `Card`
  - `lib/utils.ts` — `cn`
- **Packages:**
  - `react` — `useEffect`, `useMemo`, `useRef`, `useState`
  - `sonner` — `toast`
  - `framer-motion` — `AnimatePresence`, `motion`
  - `lucide-react` — `Plus`, `Minus`, `Building2`, `GripVertical`, `Tag`, `Save`, …
  - `next` — `useRouter`

## Used by

Entry: reached by the Next.js router at `/floor-plan` (page).
