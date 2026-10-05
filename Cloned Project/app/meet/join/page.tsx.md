# `app/meet/join/page.tsx`

> Next.js page rendered at `/meet/join`.

**Kind:** Next.js page · **Lines:** 1543 · **Directive:** `"use client"` · **Route:** `/meet/join` (page)

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Composition

**Renders:** `Button`×12 (components/ui/button.tsx), `Loader2`×10 (lucide-react), `Card`×10 (components/ui/card.tsx), `CardHeader`×9 (components/ui/card.tsx), `CardTitle`×9 (components/ui/card.tsx), `CardDescription`×9 (components/ui/card.tsx), `CardContent`×9 (components/ui/card.tsx), `Mail`×7 (lucide-react), `Calendar`×5 (lucide-react), `User`×5 (lucide-react), `Shield`×4 (lucide-react), `CheckCircle`×4 (lucide-react), `Input`×4 (components/ui/input.tsx), `AlertCircle`×2 (lucide-react), `Clock`×2 (lucide-react), `RefreshCw`×2 (lucide-react), `Video`×2 (lucide-react), `Label`×2 (components/ui/label.tsx), `MeetVideoCall` (local), `Suspense` (react), `MeetJoinContent` (local)

**Hooks used:** `useState`×17, `useEffect`×6, `useSearchParams` (next/navigation), `useRouter` (next/navigation), `useCallback`

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `default (MeetJoinPage)` | component | `MeetJoinPage()` | 1527 |

## Interfaces

- **Backend endpoints called (via `/backend`):**
  - `GET /backend/affiliate/referrer-info?affiliateId=${affiliateId}` (L187)
  - `GET /backend/public/meet/validate?code=${code}` (L234)
  - `POST /backend/public/meet/check-user` (L305)
  - `POST /backend/public/meet/host-request-otp` (L337)
  - `POST /backend/public/meet/host-verify-otp` (L375)
  - `POST /backend/public/meet/join-request-otp` (L422)
  - `POST /backend/public/meet/join-verify-otp` (L459)
  - `POST /backend/public/meet/update-name` (L510)
  - `POST /backend/public/meet/join` (L537)
- **Environment variables (`process.env`):** `NEXT_PUBLIC_API_URL`
- **Browser storage / cookies:** `meet_jwt` (sessionStorage: set), `meet_id` (sessionStorage: set), `meet_display_name` (sessionStorage: set/get), `meet_livekit_server_url` (sessionStorage: set), `meet_livekit_token` (sessionStorage: set), `meet_livekit_room_name` (sessionStorage: set), `meet_join_code` (sessionStorage: set), `meet_is_host` (sessionStorage: set/get), `meet_participant_id` (sessionStorage: set/get), `meet_status` (sessionStorage: set)
- **Timers / queues:** `setTimeout` at L662, L679

## Dependencies

- **Internal:**
  - `components/ui/button.tsx` — `Button`
  - `components/ui/input.tsx` — `Input`
  - `components/ui/label.tsx` — `Label`
  - `components/ui/card.tsx` — `Card`, `CardContent`, `CardDescription`, `CardHeader`, `CardTitle`
- **Packages:**
  - `react` — `useEffect`, `useState`, `Suspense`, `useCallback`
  - `next` — `useSearchParams`, `useRouter`
  - `sonner` — `toast`
  - `lucide-react` — `Calendar`, `Clock`, `User`, `Loader2`, `Video`, `AlertCircle`, …
  - `framer-motion` — `motion`

## Used by

Entry: reached by the Next.js router at `/meet/join` (page).

## Notes

- Large file (1543 lines) — read it by section; line numbers above point into it.
