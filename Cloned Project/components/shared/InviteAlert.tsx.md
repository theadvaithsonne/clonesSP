# `components/shared/InviteAlert.tsx`

> React component `InviteAlert`.

**Kind:** React component · **Lines:** 498 · **Directive:** `"use client"`

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Composition

**Renders:** `Check`×3 (lucide-react), `Button`×3 (components/ui/button.tsx), `TrendingUp`×2 (lucide-react), `Copy`×2 (lucide-react), `AnimatePresence` (framer-motion), `X` (lucide-react), `Crown` (lucide-react), `Building2` (lucide-react), `Users` (lucide-react), `AlertCircle` (lucide-react)

### Props

- **`InviteAlert`**: `isOpen: boolean`, `onClose: () => void`, `affiliateId: string`, `orgName?: string | null`, `orgSlug?: string | null`, `orgId?: string | null`

**Hooks used:** `useState`×5, `useEffect`

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `InviteAlert` | component | `InviteAlert({ isOpen, onClose, affiliateId, orgName, orgSlug, orgId, }:…)` | 68 |

## Interfaces

- **Backend endpoints called (via `/backend`):**
  - `GET /backend/guest-auth/guest-limit-status?orgId=${orgId}` (L88)
- **Timers / queues:** `setTimeout` at L125, L140

## Dependencies

- **Internal:**
  - `components/ui/button.tsx` — `Button`
  - `lib/utils.ts` — `cn`, `slugify`
  - `lib/api.ts` — `api`
- **Packages:**
  - `react` — `useState`, `useEffect`
  - `sonner` — `toast`
  - `lucide-react` — `Copy`, `X`, `Share2`, `Check`, `Crown`, `Building2`, …
  - `framer-motion` — `motion`, `AnimatePresence`

## Used by

No other file imports this one and it has no automatic entry point — it appears unused (or is loaded dynamically by a path the import graph cannot see).
