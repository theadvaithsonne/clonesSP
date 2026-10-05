# `app/guest/[slug]/channel/[channelId]/page.tsx`

> Next.js page rendered at `/guest/[slug]/channel/[channelId]`.

**Kind:** Next.js page · **Lines:** 905 · **Directive:** `"use client"` · **Route:** `/guest/[slug]/channel/[channelId]` (page)

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Composition

**Renders:** `Crown`×3 (lucide-react), `Star`×2 (lucide-react), `Hash`×2 (lucide-react), `Link`×2 (next/link), `Button`×2 (components/ui/button.tsx), `Unlock`×2 (lucide-react), `StarRating`×2 (local), `Users`×2 (lucide-react), `GuestNavbar` (app/guest/[slug]/components/GuestNavbar.tsx), `Lock` (lucide-react), `Calendar` (lucide-react), `Globe` (lucide-react), `ChevronUp` (lucide-react), `ChevronDown` (lucide-react), `Check` (lucide-react)

**Hooks used:** `useState`×7, `useParams` (next/navigation), `useSearchParams` (next/navigation), `useEffect`

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `default (ChannelDetailPage)` | component | `ChannelDetailPage()` | 255 |

## Interfaces

- **Backend endpoints called (via `/backend`):**
  - `GET /backend/public/channels/${channelId}` (L332)
  - `GET /backend/guest-auth/hq-by-slug/${slug}` (L350)
  - `GET /backend/guest-auth/hq-items/${slug}` (L360)
- **External hosts mentioned in the code:** `www.youtube.com`

## Dependencies

- **Internal:**
  - `lib/api.ts` — `api`
  - `components/ui/button.tsx` — `Button`
  - `app/guest/[slug]/components/GuestNavbar.tsx` — `GuestNavbar (default)`
  - `lib/utils.ts` — `cn`
- **Packages:**
  - `react` — `useState`, `useEffect`
  - `next` — `useParams`, `useSearchParams`
  - `sonner` — `toast`
  - `lucide-react` — `ArrowLeft`, `Star`, `Users`, `Check`, `ChevronDown`, `ChevronUp`, …

## Used by

Entry: reached by the Next.js router at `/guest/[slug]/channel/[channelId]` (page).

## Notes

- Security-relevant constructs: `dangerouslySetInnerHTML` (L471), `dangerouslySetInnerHTML` (L689).
