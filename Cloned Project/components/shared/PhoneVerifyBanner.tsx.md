# `components/shared/PhoneVerifyBanner.tsx`

> React component `PhoneVerifyBanner`.

**Kind:** React component · **Lines:** 367 · **Directive:** `"use client"`

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Composition

**Renders:** `Button`×3 (components/ui/button.tsx), `Phone` (lucide-react), `X` (lucide-react), `Dialog` (components/ui/dialog.tsx), `DialogContent` (components/ui/dialog.tsx), `DialogHeader` (components/ui/dialog.tsx), `ShieldCheck` (lucide-react), `DialogTitle` (components/ui/dialog.tsx), `DialogDescription` (components/ui/dialog.tsx), `ChevronDown` (lucide-react), `Search` (lucide-react), `Input` (components/ui/input.tsx)

**Hooks used:** `useState`×10, `useAuthStore`×2 (store/authStore.tsx), `useMemo`×2, `useResendCooldown` (lib/hooks/use-resend-cooldown.ts), `useEffect`

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `default (PhoneVerifyBanner)` | component | `PhoneVerifyBanner()` | 23 |

## Interfaces

- **Backend endpoints called (via `/backend`):**
  - `GET /backend/auth/me` (L53)
  - `POST /backend/auth/phone/request-otp` (L110)
  - `POST /backend/auth/phone/verify-otp` (L135)

## Dependencies

- **Internal:**
  - `lib/dialCodes.ts` — `phoneCountries`
  - `components/ui/button.tsx` — `Button`
  - `components/ui/dialog.tsx` — `Dialog`, `DialogContent`, `DialogHeader`, `DialogTitle`, `DialogDescription`
  - `components/ui/input.tsx` — `Input`
  - `lib/api.ts` — `api`
  - `store/authStore.tsx` — `useAuthStore`
  - `lib/hooks/use-resend-cooldown.ts` — `useResendCooldown`
- **Packages:**
  - `react` — `useEffect`, `useMemo`, `useState`
  - `lucide-react` — `Phone`, `X`, `ShieldCheck`, `ChevronDown`, `Search`
  - `country-state-city` — `ICountry`
  - `sonner` — `toast`

## Used by

- `app/(dashboard)/layout.tsx`
