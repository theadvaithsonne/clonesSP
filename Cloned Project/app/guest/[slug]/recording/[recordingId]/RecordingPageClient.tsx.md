# `app/guest/[slug]/recording/[recordingId]/RecordingPageClient.tsx`

> React component `RecordingPageClient`.

**Kind:** Next.js app-directory module (colocated) · **Lines:** 488 · **Directive:** `"use client"`

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Composition

**Renders:** `Button`×3 (components/ui/button.tsx), `VideoIcon`×2 (lucide-react), `ArrowRight`×2 (lucide-react), `AlertCircle` (lucide-react), `Link` (next/link), `Clock` (lucide-react), `Building2` (lucide-react), `User` (lucide-react), `GuestJoinFlow` (app/guest/[slug]/components/GuestJoinFlow.tsx)

**Hooks used:** `useState`×8, `useEffect`×5, `useRef`×2, `useParams` (next/navigation), `useSearchParams` (next/navigation), `useRouter` (next/navigation), `useCallback`

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `default (RecordingPageClient)` | component | `RecordingPageClient()` | 77 |

## Interfaces

- **Backend endpoints called (via `/backend`):**
  - `GET /backend/public/recordings/${recordingId}` (L153)
  - `GET /backend/affiliate/referrer-info?affiliateId=${referCode}` (L178)
- **Browser storage / cookies:** `guest_user_id` (localStorage: get)

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
  - `lucide-react` — `ArrowRight`, `Building2`, `User`, `AlertCircle`, `Clock`, `Video as VideoIcon`

## Used by

- `app/guest/[slug]/recording/[recordingId]/page.tsx`

## Notes

- Security-relevant constructs: `dangerouslySetInnerHTML` (L328).
