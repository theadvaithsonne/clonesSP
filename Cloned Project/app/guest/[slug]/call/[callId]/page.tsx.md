# `app/guest/[slug]/call/[callId]/page.tsx`

> Next.js page rendered at `/guest/[slug]/call/[callId]`.

**Kind:** Next.js page · **Lines:** 708 · **Directive:** `"use client"` · **Route:** `/guest/[slug]/call/[callId]` (page)

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Composition

**Renders:** `CheckCircle2`×4 (lucide-react), `Star`×3 (lucide-react), `Button`×3 (components/ui/button.tsx), `Link`×2 (next/link), `Users`×2 (lucide-react), `GuestNavbar` (app/guest/[slug]/components/GuestNavbar.tsx), `Clock` (lucide-react), `Video` (lucide-react), `Calendar` (lucide-react), `Phone` (lucide-react), `StarRating` (local), `ChevronUp` (lucide-react), `ChevronDown` (lucide-react), `ArrowRight` (lucide-react), `Mail` (lucide-react), `Shield` (lucide-react), `Award` (lucide-react), `Building2` (lucide-react)

**Hooks used:** `useState`×5, `useParams` (next/navigation), `useSearchParams` (next/navigation), `useEffect`

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `default (CallDetailPage)` | component | `CallDetailPage()` | 169 |

## Interfaces

- **Backend endpoints called (via `/backend`):**
  - `GET /backend/guest-auth/hq-by-slug/${slug}` (L196)
  - `GET /backend/public/calls/${orgId}/${callId}` (L211)

## Dependencies

- **Internal:**
  - `lib/api.ts` — `api`
  - `components/ui/button.tsx` — `Button`
  - `app/guest/[slug]/components/GuestNavbar.tsx` — `GuestNavbar (default)`
- **Packages:**
  - `react` — `useState`, `useEffect`
  - `next` — `useParams`, `useSearchParams`
  - `sonner` — `toast`
  - `lucide-react` — `Star`, `Users`, `Clock`, `Check`, `Building2`, `Phone`, …

## Used by

Entry: reached by the Next.js router at `/guest/[slug]/call/[callId]` (page).
