# `app/guest/[slug]/playlist/[playlistId]/PlaylistPageClient.tsx`

> React component `PlaylistPageClient`.

**Kind:** Next.js app-directory module (colocated) · **Lines:** 943 · **Directive:** `"use client"`

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Composition

**Renders:** `Button`×3 (components/ui/button.tsx), `Play`×3 (lucide-react), `VideoIcon`×2 (lucide-react), `ArrowRight`×2 (lucide-react), `AlertCircle` (lucide-react), `Link` (next/link), `Loader2` (lucide-react), `X` (lucide-react), `ListVideo` (lucide-react), `Clock` (lucide-react), `Building2` (lucide-react), `User` (lucide-react), `GuestJoinFlow` (app/guest/[slug]/components/GuestJoinFlow.tsx)

**Hooks used:** `useState`×11, `useEffect`×4, `useParams` (next/navigation), `useSearchParams` (next/navigation), `useRouter` (next/navigation), `useRef`

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `default (PlaylistPageClient)` | component | `PlaylistPageClient()` | 127 |

## Interfaces

- **Backend endpoints called (via `/backend`):**
  - `GET /backend/public/playlists/${playlistId}` (L204)
  - `GET /backend/affiliate/referrer-info?affiliateId=${referCode}` (L229)
- **Browser storage / cookies:** `guest_user_id` (localStorage: get)
- **Timers / queues:** `setTimeout` at L257
- **External hosts mentioned in the code:** `www.youtube.com`, `player.vimeo.com`

## Dependencies

- **Internal:**
  - `lib/api.ts` — `api`
  - `lib/auth.ts` — `getUserDataFromToken`, `isAuthenticated as checkWorkspaceAuth`
  - `components/ui/button.tsx` — `Button`
  - `app/guest/[slug]/components/GuestJoinFlow.tsx` — `GuestJoinFlow (default)`
- **Packages:**
  - `react` — `useState`, `useEffect`, `useRef`
  - `next` — `useParams`, `useSearchParams`, `useRouter`
  - `lucide-react` — `ArrowRight`, `Building2`, `User`, `AlertCircle`, `Clock`, `Video as VideoIcon`, …

## Used by

- `app/guest/[slug]/playlist/[playlistId]/page.tsx`
