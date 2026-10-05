# `app/(onboarding)/upgrade/page.tsx`

> Next.js page rendered at `/upgrade`.

**Kind:** Next.js page · **Lines:** 551 · **Directive:** `"use client"` · **Route:** `/upgrade` (page)

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Composition

**Renders:** `Loader2`×2 (lucide-react), `Button`×2 (components/ui/button.tsx), `Check`×2 (lucide-react), `Crown` (lucide-react), `ArrowLeft` (lucide-react), `CheckoutPaymentStep` (components/checkout/CheckoutPaymentStep.tsx), `Wallet` (lucide-react), `Calendar` (lucide-react)

**Hooks used:** `useState`×6, `useRouter` (next/navigation), `useEffect`, `useCallback`

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `default (UpgradeCheckoutPage)` | component | `UpgradeCheckoutPage()` | 57 |

## Interfaces

- **Backend endpoints called (via `/backend`):**
  - `GET /backend/checkout/office/${orgId}/upgrade/preview` (L92)
  - `POST /backend/checkout/office/${orgId}/subscribe` (L136)
  - `POST /backend/checkout/office/${orgId}/upgrade/initiate` (L155)
- **Browser storage / cookies:** `garage_org_id` (localStorage: get)

## Dependencies

- **Internal:**
  - `lib/api.ts` — `api`
  - `lib/auth.ts` — `getToken`
  - `components/ui/button.tsx` — `Button`
  - `lib/utils.ts` — `cn`
  - `components/checkout/CheckoutPaymentStep.tsx` — `CheckoutPaymentStep`
- **Packages:**
  - `react` — `useCallback`, `useEffect`, `useState`
  - `next` — `useRouter`
  - `sonner` — `toast`
  - `lucide-react` — `Crown`, `Check`, `Loader2`, `Wallet`, `Calendar`, `ArrowLeft`

## Used by

Entry: reached by the Next.js router at `/upgrade` (page).
