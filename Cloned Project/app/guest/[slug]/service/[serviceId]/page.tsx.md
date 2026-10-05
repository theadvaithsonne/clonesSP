# `app/guest/[slug]/service/[serviceId]/page.tsx`

> Next.js page rendered at `/guest/[slug]/service/[serviceId]`.

**Kind:** Next.js page · **Lines:** 832 · **Directive:** `"use client"` · **Route:** `/guest/[slug]/service/[serviceId]` (page)

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Composition

**Renders:** `Link`×3 (next/link), `Button`×2 (components/ui/button.tsx), `Shield`×2 (lucide-react), `StarRating`×2 (local), `Star` (lucide-react), `Code2` (lucide-react), `Palette` (lucide-react), `TrendingUp` (lucide-react), `Briefcase` (lucide-react), `GuestNavbar` (app/guest/[slug]/components/GuestNavbar.tsx), `Clock` (lucide-react), `Phone` (lucide-react), `Mail` (lucide-react), `MessageSquare` (lucide-react), `ArrowRight` (lucide-react), `Check` (lucide-react), `Target` (lucide-react), `Building2` (lucide-react)

**Hooks used:** `useState`×6, `useParams` (next/navigation), `useSearchParams` (next/navigation), `useEffect`

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `default (ServiceDetailPage)` | component | `ServiceDetailPage()` | 158 |

## Interfaces

- **Backend endpoints called (via `/backend`):**
  - `GET /backend/guest-auth/hq-by-slug/${slug}` (L209)
  - `GET /backend/public/services/${serviceId}` (L225)
  - `GET /backend/guest-auth/hq-items/${slug}` (L244)
  - `GET /backend/public/services/${serviceId}/reviews` (L267)
- **External hosts mentioned in the code:** `wa.me`

## Dependencies

- **Internal:**
  - `lib/api.ts` — `api`
  - `components/ui/button.tsx` — `Button`
  - `app/guest/[slug]/components/GuestNavbar.tsx` — `GuestNavbar (default)`
- **Packages:**
  - `react` — `useState`, `useEffect`
  - `next` — `useParams`, `useSearchParams`
  - `sonner` — `toast`
  - `lucide-react` — `Star`, `Clock`, `Check`, `Building2`, `Code2`, `Palette`, …

## Used by

Entry: reached by the Next.js router at `/guest/[slug]/service/[serviceId]` (page).
