# `app/garage-admin/login/page.tsx`

> Next.js page rendered at `/garage-admin/login`.

**Kind:** Next.js page · **Lines:** 261 · **Directive:** `"use client"` · **Route:** `/garage-admin/login` (page)

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Composition

**Renders:** `Button`×3 (components/ui/button.tsx), `ArrowRight`×2 (lucide-react), `Card` (components/ui/card.tsx), `CardHeader` (components/ui/card.tsx), `Shield` (lucide-react), `ArrowLeft` (lucide-react), `CardTitle` (components/ui/card.tsx), `CardDescription` (components/ui/card.tsx), `CardContent` (components/ui/card.tsx), `Mail` (lucide-react), `Input` (components/ui/input.tsx), `OtpInput` (components/ui/otp-input.tsx), `RotateCcw` (lucide-react)

**Hooks used:** `useState`×5, `useEffect`×2, `useRouter` (next/navigation), `useMemo`

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `default (GarageAdminLogin)` | component | `GarageAdminLogin()` | 23 |

## Interfaces

- **garage-admin API called (`my.revenue.network`):**
  - `POST /garage-admin/request-otp` (L37)
  - `POST /garage-admin/login` (L63)
- **Browser storage / cookies:** `garage_admin_token` (localStorage: set), `garage_admin_info` (localStorage: set)
- **Timers / queues:** `setInterval` at L142

## Dependencies

- **Internal:**
  - `lib/api.ts` — `garageAdminApi`
  - `components/ui/button.tsx` — `Button`
  - `components/ui/card.tsx` — `Card`, `CardContent`, `CardDescription`, `CardHeader`, `CardTitle`
  - `components/ui/input.tsx` — `Input`
  - `components/ui/otp-input.tsx` — `OtpInput (default)`
  - `lib/admin-api/permissions.ts` — `landingPathForAdmin`, `AdminPageLevel`
- **Packages:**
  - `react` — `useState`, `useEffect`, `useMemo`
  - `next` — `useRouter`
  - `lucide-react` — `Mail`, `ArrowRight`, `Shield`, `ArrowLeft`, `RotateCcw`
  - `sonner` — `toast`

## Used by

Entry: reached by the Next.js router at `/garage-admin/login` (page).
