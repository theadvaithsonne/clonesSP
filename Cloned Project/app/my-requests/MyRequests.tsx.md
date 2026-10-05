# `app/my-requests/MyRequests.tsx`

> React component `MyRequests`.

**Kind:** Next.js app-directory module (colocated) · **Lines:** 380 · **Directive:** `"use client"`

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Composition

**Renders:** `Button`×3 (components/ui/button.tsx), `Card`×3 (components/ui/card.tsx), `Clock`×2 (lucide-react), `CardContent`×2 (components/ui/card.tsx), `Building2`×2 (lucide-react), `Calendar`×2 (lucide-react), `CheckCircle2` (lucide-react), `XCircle` (lucide-react), `Loader2` (lucide-react), `ArrowLeft` (lucide-react), `PartyPopper` (lucide-react), `ArrowRight` (lucide-react), `Link` (next/link), `Sparkles` (lucide-react), `CardHeader` (components/ui/card.tsx), `CardTitle` (components/ui/card.tsx), `CardDescription` (components/ui/card.tsx), `MapPin` (lucide-react), `Mail` (lucide-react)

**Hooks used:** `useState`×3, `useRouter` (next/navigation), `useSearchParams` (next/navigation), `useEffect`

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `default (MyRequests)` | component | `MyRequests()` | 53 |

## Interfaces

- **Backend endpoints called (via `/backend`):**
  - `GET /backend/guest-auth/my-requests?userId=${userId}` (L94)
- **Browser storage / cookies:** `guest_user_id` (localStorage: get), `guest_email` (localStorage: get)

## Dependencies

- **Internal:**
  - `lib/api.ts` — `api`
  - `components/ui/button.tsx` — `Button`
  - `components/ui/card.tsx` — `Card`, `CardContent`, `CardDescription`, `CardHeader`, `CardTitle`
  - `lib/auth.ts` — `getUserIdFromToken`, `getToken`, `getUserDataFromToken`
- **Packages:**
  - `react` — `useState`, `useEffect`
  - `next` — `useRouter`, `useSearchParams`
  - `lucide-react` — `Building2`, `Clock`, `CheckCircle2`, `XCircle`, `Loader2`, `ArrowLeft`, …
  - `sonner` — `toast`

## Used by

- `app/my-requests/page.tsx`
