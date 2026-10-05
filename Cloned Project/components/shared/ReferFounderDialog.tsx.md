# `components/shared/ReferFounderDialog.tsx`

> React component `ReferFounderDialog`.

**Kind:** React component · **Lines:** 343 · **Directive:** `"use client"`

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Composition

**Renders:** `TrendingUp`×2 (lucide-react), `Check`×2 (lucide-react), `Button`×2 (components/ui/button.tsx), `AnimatePresence` (framer-motion), `X` (lucide-react), `Crown` (lucide-react), `Building2` (lucide-react), `Copy` (lucide-react)

### Props

- **`ReferFounderDialog`**: `isOpen: boolean`, `onClose: () => void`, `affiliateId: string`

**Hooks used:** `useState`

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `ReferFounderDialog` | component | `ReferFounderDialog({ isOpen, onClose, affiliateId, }: ReferFounderDialogProps)` | 61 |

## Interfaces

- **Timers / queues:** `setTimeout` at L77

## Dependencies

- **Internal:**
  - `components/ui/button.tsx` — `Button`
  - `lib/utils.ts` — `cn`
- **Packages:**
  - `react` — `useState`
  - `sonner` — `toast`
  - `lucide-react` — `Copy`, `X`, `Check`, `Crown`, `Building2`, `TrendingUp`
  - `framer-motion` — `motion`, `AnimatePresence`

## Used by

- `app/(dashboard)/layout.tsx`
- `components/dashboard/MainSidebar.tsx`
