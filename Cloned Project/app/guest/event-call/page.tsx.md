# `app/guest/event-call/page.tsx`

> Next.js page rendered at `/guest/event-call`.

**Kind:** Next.js page · **Lines:** 486 · **Directive:** `"use client"` · **Route:** `/guest/event-call` (page)

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Composition

**Renders:** `Loader2`×5 (lucide-react), `Card`×4 (components/ui/card.tsx), `CardHeader`×4 (components/ui/card.tsx), `CardTitle`×4 (components/ui/card.tsx), `CardDescription`×4 (components/ui/card.tsx), `CardContent`×4 (components/ui/card.tsx), `Button`×4 (components/ui/button.tsx), `AlertCircle`×2 (lucide-react), `Calendar`×2 (lucide-react), `User`×2 (lucide-react), `Video`×2 (lucide-react), `Clock` (lucide-react), `Label` (components/ui/label.tsx), `Input` (components/ui/input.tsx), `CheckCircle` (lucide-react), `GuestVideoCall` (local), `Suspense` (react), `GuestEventCallContent` (local)

**Hooks used:** `useState`×5, `useSearchParams` (next/navigation), `useRouter` (next/navigation), `useEffect`

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `default (GuestEventCallPage)` | component | `GuestEventCallPage()` | 470 |

## Interfaces

- **Backend endpoints called (via `/backend`):**
  - `GET /backend/public/events/validate-guest?token=${token}` (L86)
  - `POST /backend/public/events/join-guest` (L156)
- **Environment variables (`process.env`):** `NEXT_PUBLIC_API_URL`
- **Browser storage / cookies:** `guest_jwt` (sessionStorage: set), `guest_event_id` (sessionStorage: set), `guest_display_name` (sessionStorage: set), `guest_livekit_server_url` (sessionStorage: set), `guest_livekit_token` (sessionStorage: set), `guest_livekit_room_name` (sessionStorage: set)

## Dependencies

- **Internal:**
  - `components/ui/button.tsx` — `Button`
  - `components/ui/input.tsx` — `Input`
  - `components/ui/label.tsx` — `Label`
  - `components/ui/card.tsx` — `Card`, `CardContent`, `CardDescription`, `CardHeader`, `CardTitle`
- **Packages:**
  - `react` — `useEffect`, `useState`, `Suspense`
  - `next` — `useSearchParams`, `useRouter`
  - `sonner` — `toast`
  - `lucide-react` — `Calendar`, `Clock`, `User`, `Loader2`, `Video`, `AlertCircle`, …
  - `framer-motion` — `motion`

## Used by

Entry: reached by the Next.js router at `/guest/event-call` (page).
