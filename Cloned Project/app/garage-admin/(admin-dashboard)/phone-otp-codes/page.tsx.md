# `app/garage-admin/(admin-dashboard)/phone-otp-codes/page.tsx`

> Phone OTP codes — Admin → Others → Phone OTPs.

**Kind:** Next.js page · **Lines:** 239 · **Directive:** `"use client"` · **Route:** `/garage-admin/phone-otp-codes` (page)

<!-- docgen:auto -->

## Purpose
Phone OTP codes — Admin → Others → Phone OTPs.

The SMS twin of /garage-admin/otp-codes. Codes are keyed by the user's
EMAIL (that's what createOtp stores), so the backend joins in the phone
number people actually want to read off this page.

Only live codes exist to show: otpcodes carries a TTL index on
`expiresAt`, so Mongo deletes them the moment they lapse — anything in
the "expired" section here lapsed between the fetch and the render.

Backend: GET /auth/phone-otp-codes (garagenew-backend routes/auth.ts).

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Composition

**Renders:** `RefreshCw`×2 (lucide-react), `Smartphone`×2 (lucide-react), `Button` (components/ui/button.tsx), `Check` (lucide-react), `Copy` (lucide-react), `ShieldCheck` (lucide-react), `Mail` (lucide-react), `Clock` (lucide-react)

**Hooks used:** `useState`×4, `useEffect`×2

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `default (PhoneOTPCodesPage)` | component | `PhoneOTPCodesPage()` | 42 |

## Interfaces

- **garage-admin API called (`my.revenue.network`):**
  - `GET /auth/phone-otp-codes` (L51)
- **Timers / queues:** `setInterval` at L70; `setTimeout` at L84

## Dependencies

- **Internal:**
  - `lib/api.ts` — `garageAdminApi`
  - `components/ui/button.tsx` — `Button`
- **Packages:**
  - `react` — `useEffect`, `useState`
  - `lucide-react` — `RefreshCw`, `Copy`, `Check`, `Clock`, `Smartphone`, `Mail`, …
  - `sonner` — `toast`

## Used by

Entry: reached by the Next.js router at `/garage-admin/phone-otp-codes` (page).
