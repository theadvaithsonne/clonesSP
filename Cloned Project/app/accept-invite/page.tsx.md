# `app/accept-invite/page.tsx`

> Next.js page rendered at `/accept-invite`.

**Kind:** Next.js page · **Lines:** 219 · **Directive:** `"use client"` · **Route:** `/accept-invite` (page)

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Composition

**Renders:** `Input`×2 (components/ui/input.tsx), `Card` (components/ui/card.tsx), `CardHeader` (components/ui/card.tsx), `CardTitle` (components/ui/card.tsx), `CardDescription` (components/ui/card.tsx), `CardContent` (components/ui/card.tsx), `AlertTriangle` (lucide-react), `Mail` (lucide-react), `OtpInput` (components/ui/otp-input.tsx), `Phone` (lucide-react), `CheckCircle` (lucide-react), `Button` (components/ui/button.tsx), `ArrowRight` (lucide-react), `Suspense` (react), `AcceptInvitePage` (local)

**Hooks used:** `useState`×6, `useSearchParams` (next/navigation), `useRouter` (next/navigation), `useEffect`, `useMemo`

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `default (AcceptInviteWholePage)` | component | `AcceptInviteWholePage()` | 210 |

## Interfaces

- **Backend endpoints called (via `/backend`):**
  - `POST /backend/invites/accept` (L47)
- **Browser storage / cookies:** `garage_org_id` (localStorage: set)

## Dependencies

- **Internal:**
  - `lib/api.ts` — `api`
  - `lib/auth.ts` — `saveToken`
  - `lib/bat246Office.ts` — `resolveHomeFor`
  - `components/ui/button.tsx` — `Button`
  - `components/ui/card.tsx` — `Card`, `CardContent`, `CardDescription`, `CardHeader`, `CardTitle`
  - `components/ui/input.tsx` — `Input`
  - `components/ui/otp-input.tsx` — `OtpInput (default)`
- **Packages:**
  - `react` — `Suspense`, `useEffect`, `useMemo`, `useRef`, `useState`
  - `next` — `useRouter`, `useSearchParams`
  - `lucide-react` — `ArrowRight`, `Mail`, `AlertTriangle`, `Phone`, `CheckCircle`
  - `sonner` — `toast`

## Used by

Entry: reached by the Next.js router at `/accept-invite` (page).
