# `app/guest/[slug]/video/[videoId]/VideoPageClient.tsx`

> React component `VideoPageClient`.

**Kind:** Next.js app-directory module (colocated) · **Lines:** 692 · **Directive:** `"use client"`

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Composition

**Renders:** `Button`×3 (components/ui/button.tsx), `VideoIcon`×2 (lucide-react), `ArrowRight`×2 (lucide-react), `AlertCircle` (lucide-react), `Link` (next/link), `Clock` (lucide-react), `Building2` (lucide-react), `User` (lucide-react), `GuestJoinFlow` (app/guest/[slug]/components/GuestJoinFlow.tsx)

**Hooks used:** `useState`×9, `useEffect`×5, `useRef`×3, `useParams` (next/navigation), `useSearchParams` (next/navigation), `useRouter` (next/navigation), `useCallback`

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `default (VideoPageClient)` | component | `VideoPageClient()` | 107 |

## Interfaces

- **Backend endpoints called (via `/backend`):**
  - `GET /backend/public/videos/${videoId}?videoType=standalone` (L185)
  - `GET /backend/public/videos/${videoId}?videoType=workshop` (L193)
  - `GET /backend/affiliate/referrer-info?affiliateId=${referCode}` (L219)
- **Browser storage / cookies:** `guest_user_id` (localStorage: get)
- **External hosts mentioned in the code:** `www.youtube.com`, `player.vimeo.com`

## Dependencies

- **Internal:**
  - `lib/content-tracker.ts` — `ContentTracker`
  - `lib/api.ts` — `api`
  - `lib/auth.ts` — `getUserDataFromToken`, `isAuthenticated as checkWorkspaceAuth`
  - `components/ui/button.tsx` — `Button`
  - `app/guest/[slug]/components/GuestNavbar.tsx` — `GuestNavbar (default)`
  - `app/guest/[slug]/components/GuestJoinFlow.tsx` — `GuestJoinFlow (default)`
- **Packages:**
  - `react` — `useState`, `useEffect`, `useRef`, `useCallback`
  - `next` — `useParams`, `useSearchParams`, `useRouter`
  - `lucide-react` — `ArrowLeft`, `ArrowRight`, `Building2`, `User`, `Play`, `AlertCircle`, …

## Used by

- `app/guest/[slug]/video/[videoId]/page.tsx`

## Notes

- Security-relevant constructs: `dangerouslySetInnerHTML` (L494).
