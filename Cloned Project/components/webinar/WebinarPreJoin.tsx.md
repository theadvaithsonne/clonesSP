# `components/webinar/WebinarPreJoin.tsx`

> React component `WebinarPreJoin`.

**Kind:** React component · **Lines:** 3113 · **Directive:** `"use client"`

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Composition

**Renders:** `Button`×14 (components/ui/button.tsx), `Loader2`×13 (lucide-react), `Card`×11 (components/ui/card.tsx), `Input`×10 (components/ui/input.tsx), `Mail`×7 (lucide-react), `Label`×7 (components/ui/label.tsx), `Video`×7 (lucide-react), `CardHeader`×6 (components/ui/card.tsx), `CardTitle`×6 (components/ui/card.tsx), `CardDescription`×6 (components/ui/card.tsx), `CardContent`×6 (components/ui/card.tsx), `CheckCircle`×6 (lucide-react), `User`×5 (lucide-react), `InviteLine`×3 (local), `Shield`×3 (lucide-react), `AlertCircle`×2 (lucide-react), `Calendar`×2 (lucide-react), `Users`×2 (lucide-react), `SessionNotStartedCard` (components/webinar/SessionNotStartedCard.tsx), `Clock` (lucide-react), `RefreshCw` (lucide-react), `ArrowRight` (lucide-react), `CheckoutPaymentStep` (components/checkout/CheckoutPaymentStep.tsx)

### Props

- **`WebinarPreJoin`**: `webinarId: string`, `affiliateId: string`, `urlSessionDate?: string`, `onJoinReady: (guestToken: string, displayName: string, userAffiliateI…`

**Hooks used:** `useState`×22, `useEffect`×8, `useCallback`×8, `useMemo`×4, `useRef`×3, `useRouter` (next/navigation), `useSearchParams` (next/navigation)

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `default (WebinarPreJoin)` | component | `WebinarPreJoin({ webinarId, affiliateId, urlSessionDate, onJoinReady, }: W…)` | 250 |

## Interfaces

- **Backend endpoints called (via `/backend`):**
  - `GET /backend/affiliate/referrer-info?affiliateId=${affiliateId}` (L449)
  - `GET /backend/public/workshops/${webinarId}` (L471)
  - `GET /backend/public/hq-organizations/${orgId}` (L489)
  - `GET /backend/affiliate/my-affiliate-id` (L515)
  - `POST /backend/public/webinar/join-request-otp` (L541)
  - `POST /backend/public/webinar/join-verify-otp` (L584)
  - `POST /backend/public/webinar/prepare-join` (L679)
  - `POST /backend/public/webinar/demo-host-join` (L1011)
  - `POST /backend/public/webinar/join-anonymous` (L1042)
  - `POST /backend/auth/select-org` (L1183)
- **Socket.IO events:**
  - emits: `webinar:requestJoin`, `webinar:cancelJoinRequest`
  - listens for: `webinar:joinApproved`, `webinar:joinDenied`
- **Environment variables (`process.env`):** `NEXT_PUBLIC_API_URL`
- **Timers / queues:** `setInterval` at L1212

## Dependencies

- **Internal:**
  - `lib/webinar/html-text.ts` — `htmlToPlainLines`
  - `components/ui/button.tsx` — `Button`
  - `components/ui/input.tsx` — `Input`
  - `components/ui/label.tsx` — `Label`
  - `components/ui/card.tsx` — `Card`, `CardContent`, `CardDescription`, `CardHeader`, `CardTitle`
  - `lib/auth.ts` — `saveToken`, `saveOrgId`, `getToken`, `isAuthenticated`, `getUserDataFromToken`
  - `components/checkout/CheckoutPaymentStep.tsx` — `CheckoutPaymentStep`
  - `components/webinar/SessionNotStartedCard.tsx` — `SessionNotStartedCard (default)`, `CommissionLevel`, `SessionPerson`
  - `lib/zonedTime.ts` — `parseCalendarDate`, `parseWallClock`, `ymdInTimeZone`, `zonedTimeToUtc`
  - `lib/webinar/bat246GuestSession.ts` — `saveBat246GuestSession`, `readBat246GuestSession`
  - `lib/socket.ts` — `connectWebinarSocket`, `getWebinarSocket`
- **Packages:**
  - `react` — `useEffect`, `useState`, `useCallback`, `useMemo`, `useRef`, `ReactNode`
  - `next` — `useRouter`, `useSearchParams`
  - `sonner` — `toast`
  - `lucide-react` — `Calendar`, `Clock`, `User`, `Loader2`, `Video`, `AlertCircle`, …
  - `framer-motion` — `motion`

## Used by

- `app/webinar/[id]/WebinarRoomClient.tsx`

## Notes

- Large file (3113 lines) — read it by section; line numbers above point into it.
