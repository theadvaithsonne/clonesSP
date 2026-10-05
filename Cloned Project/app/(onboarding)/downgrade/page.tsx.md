# `app/(onboarding)/downgrade/page.tsx`

> Next.js page rendered at `/downgrade`.

**Kind:** Next.js page · **Lines:** 406 · **Directive:** `"use client"` · **Route:** `/downgrade` (page)

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Composition

**Renders:** `TrendingDown`×3 (lucide-react), `Button`×3 (components/ui/button.tsx), `Loader2`×2 (lucide-react), `ArrowLeft`×2 (lucide-react), `Info`×2 (lucide-react), `Check`×2 (lucide-react), `CheckCircle2` (lucide-react), `Percent` (lucide-react), `CalendarClock` (lucide-react), `ArrowRight` (lucide-react)

**Hooks used:** `useState`×4, `useRouter` (next/navigation), `useEffect`, `useCallback`

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `default (DowngradeCheckoutPage)` | component | `DowngradeCheckoutPage()` | 53 |

## Interfaces

- **Backend endpoints called (via `/backend`):**
  - `GET /backend/checkout/office/${orgId}/downgrade/preview` (L84)
  - `POST /backend/checkout/office/${orgId}/downgrade/initiate` (L119)
- **Browser storage / cookies:** `garage_org_id` (localStorage: get)

## Dependencies

- **Internal:**
  - `lib/api.ts` — `api`
  - `lib/auth.ts` — `getToken`
  - `components/ui/button.tsx` — `Button`
  - `lib/utils.ts` — `cn`
- **Packages:**
  - `react` — `useCallback`, `useEffect`, `useState`
  - `next` — `useRouter`
  - `sonner` — `toast`
  - `lucide-react` — `ArrowLeft`, `ArrowRight`, `CalendarClock`, `Check`, `CheckCircle2`, `Info`, …

## Used by

Entry: reached by the Next.js router at `/downgrade` (page).
