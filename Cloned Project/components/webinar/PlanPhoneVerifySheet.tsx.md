# `components/webinar/PlanPhoneVerifySheet.tsx`

> Phone verification for a Garage Store plan purchase.

**Kind:** React component · **Lines:** 373 · **Directive:** `"use client"`

<!-- docgen:auto -->

## Purpose
Phone verification for a Garage Store plan purchase.

Shown when the buyer's 24-hour free-first-cycle window has never started —
i.e. they've never been onboarded onto the partner (NetworkChains). All we
ask for is the phone number: verifying it is what unlocks the offer.

`POST /auth/phone/verify-otp` stamps `profileCompletedAt` on success, which
is what starts the window (backend services/comboWindow.ts). Nothing else
is collected here — no address, no second round-trip.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Composition

**Renders:** `Loader2`×2 (lucide-react), `AnimatePresence` (framer-motion), `ShieldCheck` (lucide-react), `X` (lucide-react), `ChevronDown` (lucide-react), `Search` (lucide-react)

### Props

- **`PlanPhoneVerifySheet`**: `open: boolean`, `onClose: () => void`, `onVerified: () => void`, `planLabel?: string`, `context?: { workshopId?: string; itemType?: string; itemId?: string; …`

**Hooks used:** `useState`×7, `useMemo`×2, `useEffect`×2, `useAuthStore` (store/authStore.tsx), `useResendCooldown` (lib/hooks/use-resend-cooldown.ts)

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `default (PlanPhoneVerifySheet)` | component | `PlanPhoneVerifySheet({ open, onClose, onVerified, planLabel, context, }: Props)` | 57 |

## Interfaces

- **Other fetch/api calls (target not statically resolvable):**
  - `GET profile?userId=${encodeURIComponent(userId)}` (L103)
  - `POST auth/phone/request-otp` (L145)
  - `POST auth/phone/verify-otp` (L170)

## Dependencies

- **Internal:**
  - `lib/dialCodes.ts` — `phoneCountries`
  - `lib/api.ts` — `api`
  - `lib/hooks/use-resend-cooldown.ts` — `useResendCooldown`
  - `lib/auth.ts` — `getUserDataFromToken`
  - `store/authStore.tsx` — `useAuthStore`
- **Packages:**
  - `react` — `useEffect`, `useMemo`, `useState`
  - `react-dom` — `createPortal`
  - `framer-motion` — `AnimatePresence`, `motion`
  - `lucide-react` — `X`, `ShieldCheck`, `Loader2`, `ChevronDown`, `Search`
  - `country-state-city` — `ICountry`
  - `sonner` — `toast`

## Used by

- `app/webinar/[id]/WebinarRoomClient.tsx`
