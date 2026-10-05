# `app/garage-admin/(admin-dashboard)/otp-codes/page.tsx`

> Next.js page rendered at `/garage-admin/otp-codes`.

**Kind:** Next.js page · **Lines:** 223 · **Directive:** `"use client"` · **Route:** `/garage-admin/otp-codes` (page)

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Composition

**Renders:** `RefreshCw`×2 (lucide-react), `Button` (components/ui/button.tsx), `Check` (lucide-react), `Copy` (lucide-react), `Mail` (lucide-react), `Clock` (lucide-react)

**Hooks used:** `useState`×4, `useEffect`

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `default (OTPCodesPage)` | component | `OTPCodesPage()` | 19 |

## Interfaces

- **garage-admin API called (`my.revenue.network`):**
  - `GET /auth/otp-codes` (L28)
- **Browser storage / cookies:** `garage_admin_token` (localStorage: get)
- **Timers / queues:** `setTimeout` at L57

## Dependencies

- **Internal:**
  - `lib/api.ts` — `garageAdminApi`
  - `components/ui/button.tsx` — `Button`
- **Packages:**
  - `react` — `useEffect`, `useState`
  - `lucide-react` — `RefreshCw`, `Copy`, `Check`, `Clock`, `Mail`
  - `sonner` — `toast`

## Used by

Entry: reached by the Next.js router at `/garage-admin/otp-codes` (page).
