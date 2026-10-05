# `app/guest/[slug]/drop/[dropId]/DropPageClient.tsx`

> React component `DropPageClient`.

**Kind:** Next.js app-directory module (colocated) · **Lines:** 729 · **Directive:** `"use client"`

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Composition

**Renders:** `Button`×3 (components/ui/button.tsx), `ArrowRight`×2 (lucide-react), `AlertCircle` (lucide-react), `Link` (next/link), `Play` (lucide-react), `Pause` (lucide-react), `VolumeX` (lucide-react), `Volume2` (lucide-react), `Building2` (lucide-react), `User` (lucide-react), `GuestJoinFlow` (app/guest/[slug]/components/GuestJoinFlow.tsx)

**Hooks used:** `useState`×12, `useEffect`×8, `useRef`×4, `useParams` (next/navigation), `useSearchParams` (next/navigation), `useRouter` (next/navigation)

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `default (DropPageClient)` | component | `DropPageClient()` | 103 |

## Interfaces

- **Backend endpoints called (via `/backend`):**
  - `GET /backend/guest-auth/hq-by-slug/${slug}?userId=${guestUserId}` (L160)
  - `GET /backend/drops/public/${dropId}` (L175)
  - `GET /backend/affiliate/referrer-info?affiliateId=${referCode}` (L200)
  - `POST /backend/drops/${dropId}/view` (L215)
- **Browser storage / cookies:** `guest_user_id` (localStorage: get)
- **Timers / queues:** `setTimeout` at L214, L331; `setInterval` at L274
- **External hosts mentioned in the code:** `www.youtube.com`, `player.vimeo.com`

## Dependencies

- **Internal:**
  - `lib/content-tracker.ts` — `ContentTracker`
  - `lib/api.ts` — `api`
  - `lib/auth.ts` — `getUserDataFromToken`, `isAuthenticated as checkWorkspaceAuth`
  - `components/ui/button.tsx` — `Button`
  - `app/guest/[slug]/components/GuestJoinFlow.tsx` — `GuestJoinFlow (default)`
- **Packages:**
  - `react` — `useState`, `useEffect`, `useRef`, `useCallback`
  - `next` — `useParams`, `useSearchParams`, `useRouter`
  - `lucide-react` — `ArrowRight`, `Building2`, `User`, `AlertCircle`, `Volume2`, `VolumeX`, …

## Used by

- `app/guest/[slug]/drop/[dropId]/page.tsx`
