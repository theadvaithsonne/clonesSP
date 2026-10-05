# `app/garage-admin/(admin-dashboard)/coworking-spaces/new/page.tsx`

> Next.js page rendered at `/garage-admin/coworking-spaces/new`.

**Kind:** Next.js page · **Lines:** 874 · **Directive:** `"use client"` · **Route:** `/garage-admin/coworking-spaces/new` (page)

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Composition

**Renders:** `Input`×10 (components/ui/input.tsx), `Card`×6 (components/ui/card.tsx), `CardContent`×6 (components/ui/card.tsx), `CardHeader`×5 (components/ui/card.tsx), `CardTitle`×5 (components/ui/card.tsx), `Button`×4 (components/ui/button.tsx), `Badge`×3 (components/ui/badge.tsx), `Plus`×3 (lucide-react), `InlineEdit`×2 (local), `Star`×2 (lucide-react), `X`×2 (lucide-react), `MapPin`×2 (lucide-react), `Users`×2 (lucide-react), `Pencil` (lucide-react), `ArrowLeft` (lucide-react), `Save` (lucide-react), `ChevronLeft` (lucide-react), `ChevronRight` (lucide-react), `Landmark` (lucide-react), `ChevronDown` (lucide-react), `CardDescription` (components/ui/card.tsx), `Trash2` (lucide-react), `Calendar` (lucide-react)

**Hooks used:** `useState`×22, `useRef`×2, `useRouter` (next/navigation), `useEffect`

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `default (NewCoworkingSpacePage)` | component | `NewCoworkingSpacePage()` | 127 |

## Interfaces

- **Backend endpoints called (via `/backend`):**
  - `POST /backend/garage-admin/upload` (L197)
- **garage-admin API called (`my.revenue.network`):**
  - `POST /garage-admin/coworking-spaces` (L334)
- **Browser storage / cookies:** `garage_admin_token` (localStorage: get)
- **Timers / queues:** `setTimeout` at L69

## Dependencies

- **Internal:**
  - `lib/api.ts` — `garageAdminApi`, `API_URL`
  - `components/ui/button.tsx` — `Button`
  - `components/ui/card.tsx` — `Card`, `CardContent`, `CardDescription`, `CardHeader`, `CardTitle`
  - `components/ui/badge.tsx` — `Badge`
  - `components/ui/input.tsx` — `Input`
- **Packages:**
  - `react` — `useState`, `useRef`, `useEffect`
  - `next` — `useRouter`
  - `lucide-react` — `ArrowLeft`, `Plus`, `Trash2`, `X`, `Landmark`, `MapPin`, …
  - `sonner` — `toast`
  - `country-state-city` — `City`, `State`, `Country`

## Used by

Entry: reached by the Next.js router at `/garage-admin/coworking-spaces/new` (page).
