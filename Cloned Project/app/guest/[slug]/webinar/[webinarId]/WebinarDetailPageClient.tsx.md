# `app/guest/[slug]/webinar/[webinarId]/WebinarDetailPageClient.tsx`

> React component `WebinarDetailPage`.

**Kind:** Next.js app-directory module (colocated) · **Lines:** 893 · **Directive:** `"use client"`

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Composition

**Renders:** `Video`×3 (lucide-react), `Check`×3 (lucide-react), `Star`×2 (lucide-react), `Link`×2 (next/link), `Button`×2 (components/ui/button.tsx), `StarRating`×2 (local), `Users`×2 (lucide-react), `Monitor`×2 (lucide-react), `Globe`×2 (lucide-react), `GuestNavbar` (app/guest/[slug]/components/GuestNavbar.tsx), `Calendar` (lucide-react), `Clock` (lucide-react), `Play` (lucide-react), `ChevronUp` (lucide-react), `ChevronDown` (lucide-react), `Zap` (lucide-react), `Bell` (lucide-react), `Download` (lucide-react)

**Hooks used:** `useState`×6, `useParams` (next/navigation), `useSearchParams` (next/navigation), `useEffect`

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `default (WebinarDetailPage)` | component | `WebinarDetailPage()` | 281 |

## Interfaces

- **Backend endpoints called (via `/backend`):**
  - `GET /backend/public/workshops/${webinarId}` (L336)
  - `GET /backend/guest-auth/hq-by-slug/${slug}` (L354)
  - `GET /backend/guest-auth/hq-items/${slug}` (L364)

## Dependencies

- **Internal:**
  - `lib/api.ts` — `api`
  - `lib/utils.ts` — `parseDateLocal`, `formatTime12Hour`
  - `components/ui/button.tsx` — `Button`
  - `app/guest/[slug]/components/GuestNavbar.tsx` — `GuestNavbar (default)`
- **Packages:**
  - `react` — `useState`, `useEffect`
  - `next` — `useParams`, `useSearchParams`
  - `sonner` — `toast`
  - `lucide-react` — `ArrowLeft`, `Star`, `Users`, `Clock`, `Globe`, `Calendar`, …

## Used by

- `app/guest/[slug]/webinar/[webinarId]/page.tsx`

## Notes

- Security-relevant constructs: `dangerouslySetInnerHTML` (L695).
