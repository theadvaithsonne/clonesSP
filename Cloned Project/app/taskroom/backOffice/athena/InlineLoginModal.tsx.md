# `app/taskroom/backOffice/athena/InlineLoginModal.tsx`

> React component `InlineLoginModal`.

**Kind:** Next.js app-directory module (colocated) · **Lines:** 389 · **Directive:** `"use client"`

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Composition

**Renders:** `StepDot`×2 (local), `Button`×2 (components/ui/button.tsx), `Loader2`×2 (lucide-react), `ArrowRight`×2 (lucide-react), `Dialog` (components/ui/dialog.tsx), `DialogContent` (components/ui/dialog.tsx), `DialogTitle` (components/ui/dialog.tsx), `DialogDescription` (components/ui/dialog.tsx), `Image` (next/image), `AnimatePresence` (framer-motion), `Mail` (lucide-react), `Input` (components/ui/input.tsx), `ShieldCheck` (lucide-react), `Sparkles` (lucide-react), `OtpInput` (components/ui/otp-input.tsx), `ArrowLeft` (lucide-react), `RotateCcw` (lucide-react)

### Props

- **`InlineLoginModal`**: `open: boolean`, `targetOrgId?: string | null`, `onAuthenticated: (outcome: AuthOutcome) => void`

**Hooks used:** `useState`×5, `useEffect`×2, `useMemo`

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `default (InlineLoginModal)` | component | `InlineLoginModal({ open, targetOrgId, onAuthenticated, }: Props)` | 38 |

## Interfaces

- **Backend endpoints called (via `/backend`):**
  - `POST /backend/auth/request-otp` (L68)
  - `POST /backend/auth/verify-otp` (L88)
  - `POST /backend/auth/select-org` (L113)

## Dependencies

- **Internal:**
  - `lib/api.ts` — `api`
  - `lib/auth.ts` — `saveToken`, `saveOrgId`
  - `components/ui/button.tsx` — `Button`
  - `components/ui/input.tsx` — `Input`
  - `components/ui/dialog.tsx` — `Dialog`, `DialogContent`, `DialogDescription`, `DialogTitle`
  - `components/ui/otp-input.tsx` — `OtpInput (default)`
- **Packages:**
  - `react` — `useEffect`, `useMemo`, `useState`
  - `next`
  - `framer-motion` — `motion`, `AnimatePresence`
  - `lucide-react` — `ArrowRight`, `ArrowLeft`, `Loader2`, `Mail`, `RotateCcw`, `ShieldCheck`, …
  - `sonner` — `toast`

## Used by

- `app/taskroom/backOffice/athena/AthenaDeepLink.tsx`
