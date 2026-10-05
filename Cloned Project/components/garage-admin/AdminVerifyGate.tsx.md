# `components/garage-admin/AdminVerifyGate.tsx`

> "Verify your admin" — the step-up gate over the admin console, asked once per login.

**Kind:** React component · **Lines:** 297 · **Directive:** `"use client"`

<!-- docgen:auto -->

## Purpose
"Verify your admin" — the step-up gate over the admin console, asked once
per login. The chrome behind it is blurred and inert; the page's own
content is replaced by a skeleton rather than blurred, because a blur is
a CSS property and the DOM under it stays readable.

Layout: one wide card split in two. The left panel carries the identity
of the moment — what this is, and who it thinks you are — and the right
panel is the task itself: one question, one line to answer it on. The
answer field is deliberately not a box; it's a single rule under the
question, so the card reads as a sentence to complete rather than a form
to fill in.

The real enforcement is server-side: every admin route returns 403
ADMIN_VERIFICATION_REQUIRED until the token carries the verified claim.
This component is how you obtain that token, not the lock itself.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Composition

**Renders:** `LogOut`×2 (lucide-react), `SignedOut` (local), `ShieldCheck` (lucide-react), `ArrowRight` (lucide-react), `Loader2` (lucide-react), `RefreshCw` (lucide-react)

### Props

- **`AdminVerifyGate`**: `challenge: AdminVerifyChallenge`, `adminName?: string`, `adminEmail?: string`, `onVerified: () => void`

**Hooks used:** `useState`×6, `useCallback`×2, `useMemo`, `useRef`, `useEffect`

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `AdminVerifyGate` | component | `AdminVerifyGate({ challenge, adminName, adminEmail, onVerified, }: { challe…)` | 27 |
| `AdminVerifySkeleton` | component | `AdminVerifySkeleton()` — Stand-in for the page content while the gate is up. | 284 |

## Interfaces

- **Timers / queues:** `setTimeout` at L83

## Dependencies

- **Internal:**
  - `lib/admin-api/admin-verify.ts` — `signOutAdmin`, `submitAdminVerification`, `AdminVerifyChallenge`
- **Packages:**
  - `react` — `useCallback`, `useEffect`, `useMemo`, `useRef`, `useState`
  - `lucide-react` — `ShieldCheck`, `Loader2`, `LogOut`, `RefreshCw`, `ArrowRight`

## Used by

- `app/garage-admin/(admin-dashboard)/layout.tsx`
