# `components/dashboard/EmailSenderSetup.tsx`

> White-label sender domain (Resend).

**Kind:** React component · **Lines:** 343 · **Directive:** `"use client"`

<!-- docgen:auto -->

## Purpose
White-label sender domain (Resend).

Lets a founder send this office's transactional mail — invites, approvals,
notifications — from their OWN domain instead of Garage's.

Deliberately distinct from the Mailcow setup on the same page, and the copy
says so, because the two look interchangeable and are not:

  Mailcow  — mailboxes. Receiving, IMAP, a real account someone logs into.
  Resend   — outbound only. No inbox.

Both can run on the same domain. That is exactly why the SPF record shown
here may differ from the raw value Resend returns: a domain may publish only
one SPF record, so the backend merges Resend's include into any existing one
(see services/resendDomains.ts). Publishing both separately would break mail
for both senders with nothing in any log to explain it.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Composition

**Renders:** `Loader2`×3 (lucide-react), `Badge`×3 (components/ui/badge.tsx), `Button`×3 (components/ui/button.tsx), `Input`×2 (components/ui/input.tsx), `Mail` (lucide-react), `RefreshCw` (lucide-react), `CheckCircle2` (lucide-react), `AlertCircle` (lucide-react), `Copy` (lucide-react)

### Props

- **`EmailSenderSetup`**: `orgId: string | null`

**Hooks used:** `useState`×6, `useCallback`, `useEffect`

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `default (EmailSenderSetup)` | component | `EmailSenderSetup({ orgId }: { orgId: string \| null })` | 57 |

## Interfaces

- **Backend endpoints called (via `/backend`):**
  - `GET /backend/initial-setup/email-sender?orgId=${encodeURIComponent(orgId)}` (L69)
  - `POST /backend/initial-setup/email-sender` (L97)
  - `POST /backend/initial-setup/email-sender/verify` (L125)

## Dependencies

- **Internal:**
  - `components/ui/button.tsx` — `Button`
  - `components/ui/input.tsx` — `Input`
  - `components/ui/badge.tsx` — `Badge`
  - `lib/api.ts` — `api`
- **Packages:**
  - `react` — `useCallback`, `useEffect`, `useState`
  - `lucide-react` — `Loader2`, `Copy`, `CheckCircle2`, `AlertCircle`, `Mail`, `RefreshCw`
  - `sonner` — `toast`

## Used by

- `components/dashboard/InitialSetupPage.tsx`
