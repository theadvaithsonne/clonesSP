# `components/events/checkout/CheckoutIdentity.tsx`

> Who is buying, at the top of the attendee step.

**Kind:** React component · **Lines:** 239 · **Directive:** `"use client"`

<!-- docgen:auto -->

## Purpose
Who is buying, at the top of the attendee step.

Signed in → a banner and the buyer's details pre-filled. Signed out → a
two-field OTP sign-in, the same `/auth/request-otp` + `/auth/verify-otp`
pair the rest of the app uses, carrying the `referralCode` from the share
link the visitor arrived on.

This is a REQUIRED step, not an offer: the checkout will not submit until
it reports a signed-in user. Two reasons it has to be. `/auth/verify-otp`
is what binds a new account to the affiliate who shared the link, so a guest
checkout earns the sharer nothing; and a ticket held by an account is one
the attendee can find again from any device, which a guest order is not.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Composition

**Renders:** `Loader2`×2 (lucide-react), `UserCheck` (lucide-react), `CheckCircle2` (lucide-react)

### Props

- **`CheckoutIdentity`**: `accent: string`, `referralCode?: string`, `onSignedIn: (user: { name: string; email: string; phone?: string }) =…`

**Hooks used:** `useState`×5, `useAuthStore`×3 (store/authStore.tsx)

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `default (CheckoutIdentity)` | component | `CheckoutIdentity({ accent, referralCode, onSignedIn, }: { accent: string; /*…)` | 37 |

## Interfaces

- **Backend endpoints called (via `/backend`):**
  - `POST /backend/auth/request-otp` (L97)
  - `POST /backend/auth/verify-otp` (L117)

## Dependencies

- **Internal:**
  - `lib/api.ts` — `api`
  - `lib/auth.ts` — `saveToken`
  - `store/authStore.tsx` — `useAuthStore`
  - `components/events/checkout/ui.tsx` — `C`
- **Packages:**
  - `react` — `useState`
  - `lucide-react` — `CheckCircle2`, `Loader2`, `UserCheck`

## Used by

- `app/events/[id]/checkout/CheckoutClient.tsx`
