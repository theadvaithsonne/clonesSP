# `components/meet/MeetPreJoin.tsx`

> React component `MeetPreJoin`.

**Kind:** React component · **Lines:** 495 · **Directive:** `"use client"`

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Composition

**Renders:** `Loader2`×2 (lucide-react), `UserIcon`×2 (lucide-react), `Mail` (lucide-react), `Shield` (lucide-react), `OtpInput` (components/ui/otp-input.tsx)

### Props

- **`MeetPreJoin`**: `title?: string`, `affiliateId?: string`, `onReady: () => void`, `onGuestJoin?: (name: string) => Promise<void>`

**Hooks used:** `useState`×7, `useEffect`×3, `useRouter` (next/navigation), `useCallback`

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `MeetPreJoinProps` | interface |  | 29 |
| `default (MeetPreJoin)` | component | `MeetPreJoin({ title, affiliateId, onReady, onGuestJoin, }: MeetPreJoinP…)` — Pre-join screen for meet rooms — mirrors WebinarPreJoin's OTP flow against Garage's /auth/request-otp + /auth/verify-otp (the same endpoints NC's login uses). | 53 |

## Interfaces

- **External HTTP calls:**
  - `GET test.garage.app/affiliate/referrer-info?affiliateId=${encodeURIComponent(id)}` (L82)
  - `POST test.garage.app/auth/request-otp` (L102)
  - `POST test.garage.app/auth/verify-otp` (L132)
  - `POST test.garage.app/auth/select-org` (L159)
- **Environment variables (`process.env`):** `NEXT_PUBLIC_AUTH_API_URL`, `NEXT_PUBLIC_GARAGE_API_URL`
- **Browser storage / cookies:** `nc_guest_email` (localStorage: get/set)
- **External hosts mentioned in the code:** `test.garage.app`

## Dependencies

- **Internal:**
  - `components/ui/otp-input.tsx` — `OtpInput (default)`
  - `lib/auth.ts` — `saveToken`, `saveOrgId`
- **Packages:**
  - `react` — `useCallback`, `useEffect`, `useState`
  - `next` — `useRouter`
  - `lucide-react` — `Loader2`, `Mail`, `Shield`, `User as UserIcon`
  - `framer-motion` — `motion`

## Used by

No other file imports this one and it has no automatic entry point — it appears unused (or is loaded dynamically by a path the import graph cannot see).
