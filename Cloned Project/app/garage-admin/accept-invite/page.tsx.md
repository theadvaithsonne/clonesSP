# `app/garage-admin/accept-invite/page.tsx`

> Next.js page rendered at `/garage-admin/accept-invite`.

**Kind:** Next.js page · **Lines:** 212 · **Directive:** `"use client"` · **Route:** `/garage-admin/accept-invite` (page)

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Composition

**Renders:** `Card` (components/ui/card.tsx), `CardHeader` (components/ui/card.tsx), `Shield` (lucide-react), `CardTitle` (components/ui/card.tsx), `CardDescription` (components/ui/card.tsx), `CardContent` (components/ui/card.tsx), `AlertTriangle` (lucide-react), `Mail` (lucide-react), `Input` (components/ui/input.tsx), `OtpInput` (components/ui/otp-input.tsx), `CheckCircle` (lucide-react), `Button` (components/ui/button.tsx), `ArrowRight` (lucide-react), `Suspense` (react), `AcceptGarageAdminInvitePage` (local)

**Hooks used:** `useState`×4, `useSearchParams` (next/navigation), `useRouter` (next/navigation), `useEffect`, `useMemo`

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `default (AcceptGarageAdminInviteWholePage)` | component | `AcceptGarageAdminInviteWholePage()` | 203 |

## Interfaces

- **garage-admin API called (`my.revenue.network`):**
  - `POST /garage-admin/login` (L45)
- **Browser storage / cookies:** `garage_admin_token` (localStorage: set), `garage_admin_info` (localStorage: set)

## Dependencies

- **Internal:**
  - `lib/api.ts` — `garageAdminApi`
  - `components/ui/button.tsx` — `Button`
  - `components/ui/card.tsx` — `Card`, `CardContent`, `CardDescription`, `CardHeader`, `CardTitle`
  - `components/ui/input.tsx` — `Input`
  - `components/ui/otp-input.tsx` — `OtpInput (default)`
  - `lib/admin-api/permissions.ts` — `landingPathForAdmin`, `AdminPageLevel`
- **Packages:**
  - `react` — `Suspense`, `useEffect`, `useMemo`, `useState`
  - `next` — `useRouter`, `useSearchParams`
  - `lucide-react` — `ArrowRight`, `Mail`, `AlertTriangle`, `Shield`, `CheckCircle`
  - `sonner` — `toast`

## Used by

Entry: reached by the Next.js router at `/garage-admin/accept-invite` (page).
