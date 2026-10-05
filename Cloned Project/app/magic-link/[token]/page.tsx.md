# `app/magic-link/[token]/page.tsx`

> Public NetworkChain offer page: my.garage.app/magic-link/<token>

**Kind:** Next.js page · **Lines:** 410 · **Directive:** `"use client"` · **Route:** `/magic-link/[token]` (page)

<!-- docgen:auto -->

## Purpose
Public NetworkChain offer page: my.garage.app/magic-link/<token>

The token identifies WHO the offer is for and WHICH plan — never the price.
Every load re-quotes server-side, so a link opened after the 24-hour offer
window lapses shows normal prices rather than one we'd refuse to honour.

No login to view, matching /invoice/[invoiceId]. Paying is gated by the email
OTP that page already enforces, which is where we hand off.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Composition

**Renders:** `Notice`×5 (local), `Shell`×3 (local), `Loader2`×2 (lucide-react), `Icon` (local), `Sparkles` (lucide-react), `Clock` (lucide-react), `Check` (lucide-react), `ShieldCheck` (lucide-react)

**Hooks used:** `useState`×7, `useEffect`×2, `useParams` (next/navigation), `useRouter` (next/navigation), `useCallback`

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `default (MagicLinkPage)` | component | `MagicLinkPage()` | 107 |

## Interfaces

- **Backend endpoints called (via `/backend`):**
  - `GET /backend/magic-link/${token}` (L125)
  - `POST /backend/magic-link/${token}/checkout` (L175)
- **Timers / queues:** `setInterval` at L157

## Dependencies

- **Internal:**
  - `lib/api.ts` — `API_URL`
- **Packages:**
  - `react` — `useCallback`, `useEffect`, `useState`
  - `next` — `useParams`, `useRouter`
  - `lucide-react` — `Loader2`, `AlertCircle`, `Check`, `Clock`, `ShieldCheck`, `Sparkles`

## Used by

Entry: reached by the Next.js router at `/magic-link/[token]` (page).
