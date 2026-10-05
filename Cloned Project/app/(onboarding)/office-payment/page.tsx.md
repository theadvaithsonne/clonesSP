# `app/(onboarding)/office-payment/page.tsx`

> Next.js page rendered at `/office-payment`.

**Kind:** Next.js page · **Lines:** 859 · **Directive:** `"use client"` · **Route:** `/office-payment` (page)

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Composition

**Renders:** `Lock`×3 (lucide-react), `Check`×3 (lucide-react), `Loader2`×2 (lucide-react), `ProfilePopover` (components/shared/ProfilePopover.tsx), `Crown` (lucide-react), `Sparkles` (lucide-react), `Info` (lucide-react), `Button` (components/ui/button.tsx), `Suspense` (react), `OfficePaymentPageContent` (local)

**Hooks used:** `useState`×10, `useMemo`×3, `useEffect`×2, `useRouter` (next/navigation), `useSearchParams` (next/navigation)

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `default (OfficePaymentPage)` | component | `OfficePaymentPage()` | 850 |

## Interfaces

- **Backend endpoints called (via `/backend`):**
  - `GET /backend/profile/status?userId=${userId}` (L110)
  - `GET /backend/checkout/office/plans` (L132)
  - `GET /backend/checkout/office/${currentOrgId}` (L150)
  - `POST /backend/checkout/office/${currentOrgId}/subscribe` (L246)
  - `POST /backend/checkout/office/${currentOrgId}/start-trial` (L270)

## Dependencies

- **Internal:**
  - `lib/api.ts` — `api`
  - `lib/auth.ts` — `getToken`, `getUserDataFromToken`
  - `components/shared/ProfilePopover.tsx` — `ProfilePopover`
  - `components/ui/button.tsx` — `Button`
  - `lib/utils.ts` — `cn`
- **Packages:**
  - `react` — `useState`, `useEffect`, `Suspense`, `useMemo`
  - `next` — `useRouter`, `useSearchParams`
  - `sonner` — `toast`
  - `lucide-react` — `Check`, `Loader2`, `Crown`, `Sparkles`, `Minus`, `Plus`, …

## Used by

Entry: reached by the Next.js router at `/office-payment` (page).

## Notes

- `page.tsx`:656 — /}
