# `components/shared/AssociateAccountCard.tsx`

> "Already have an account?" — shown inside Complete Profile.

**Kind:** React component · **Lines:** 294 · **Directive:** `"use client"`

<!-- docgen:auto -->

## Purpose
"Already have an account?" — shown inside Complete Profile.

Logging in by phone creates an account when the number matches none, so
someone whose number was never on file lands in an empty one and reasonably
thinks their history is gone. This is the way back: name the real account by
email, prove ownership with a code sent there, and the phone moves across
while the throwaway is deleted.

The same box is also how a phone signup ADDS an email. When nobody holds the
address, the backend sends a code to it instead ("add" mode) and saves it on
this account once confirmed. Before that branch existed a new email was a
dead end — the profile's email field is read-only, and PUT /profile takes no
email — so these accounts never got one, or the sign-up offer email.

Only rendered for an account that could plausibly BE a throwaway — a
verified phone and no email. Showing it to an ordinary user would be an […]

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Composition

**Renders:** `Input`×2 (components/ui/input.tsx), `Button`×2 (components/ui/button.tsx), `Loader2`×2 (lucide-react), `Link2` (lucide-react), `ShieldCheck` (lucide-react), `ArrowLeft` (lucide-react)

### Props

- **`AssociateAccountCard`**: `onDone?: () => void`

**Hooks used:** `useState`×6, `useAuthStore` (store/authStore.tsx)

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `AssociateAccountCard` | component | `AssociateAccountCard({ onDone }: { onDone?: () => void })` | 56 |
| `default (AssociateAccountCard)` | component | `AssociateAccountCard({ onDone }: { onDone?: () => void })` | 293 |

## Interfaces

- **Backend endpoints called (via `/backend`):**
  - `POST /backend/auth/associate/request-otp` (L78)
  - `POST /backend/auth/associate/verify` (L125)
  - `POST /backend/auth/email/verify` (L165)

## Dependencies

- **Internal:**
  - `lib/api.ts` — `api`
  - `lib/auth.ts` — `saveToken`, `saveOrgId`
  - `store/authStore.tsx` — `useAuthStore`
  - `lib/identifier.ts` — `isValidEmail`
  - `components/ui/button.tsx` — `Button`
  - `components/ui/input.tsx` — `Input`
- **Packages:**
  - `react` — `useState`
  - `sonner` — `toast`
  - `lucide-react` — `Loader2`, `Link2`, `ArrowLeft`, `ShieldCheck`

## Used by

- `components/shared/ProfilePopover.tsx`
