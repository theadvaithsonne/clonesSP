# `app/save-card/[token]/page.tsx`

> Public save-card page — opened by a user who received an admin-generated add-card link.

**Kind:** Next.js page · **Lines:** 247 · **Directive:** `"use client"` · **Route:** `/save-card/[token]` (page)

<!-- docgen:auto -->

## Purpose
Public save-card page — opened by a user who received an
admin-generated add-card link. NO auth. The token in the URL IS the
auth: it's a short-lived JWT scoped to `save_card_admin_link` and
bound to a specific SetupIntent minted by the admin.

Flow:
  1. Exchange token → clientSecret + publishableKey + recipient info
  2. Render Stripe Elements bound to the SetupIntent
  3. User enters card + confirms RBI mandate (bundled server-side)
  4. On success, existing `setup_intent.succeeded` webhook persists
     the PaymentMethod to User.paymentProfile.stripe.methods[] — no
     further client action needed.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Composition

**Renders:** `Loader2`×2 (lucide-react), `CheckCircle2` (lucide-react), `Elements` (@stripe/react-stripe-js), `SetupIntentForm` (local), `ShieldCheck` (lucide-react), `PaymentElement` (@stripe/react-stripe-js)

**Hooks used:** `useState`×4, `useParams` (next/navigation), `useEffect`, `useStripe` (@stripe/react-stripe-js), `useElements` (@stripe/react-stripe-js)

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `default (AdminSaveCardPage)` | component | `AdminSaveCardPage()` | 52 |

## Interfaces

- **Backend endpoints called (via `/backend`):**
  - `POST /backend/public/save-card/exchange` (L62)

## Dependencies

- **Internal:**
  - `lib/api.ts` — `API_URL`
- **Packages:**
  - `react` — `useEffect`, `useState`
  - `next` — `useParams`
  - `@stripe/stripe-js` — `loadStripe`, `Stripe`
  - `@stripe/react-stripe-js` — `Elements`, `PaymentElement`, `useElements`, `useStripe`
  - `lucide-react` — `CheckCircle2`, `Loader2`, `ShieldCheck`

## Used by

Entry: reached by the Next.js router at `/save-card/[token]` (page).
