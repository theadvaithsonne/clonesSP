# `app/(landing)/profile-setup/page.tsx`

> Next.js page rendered at `/profile-setup`.

**Kind:** Next.js page · **Lines:** 270 · **Directive:** `"use client"` · **Route:** `/profile-setup` (page)

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Composition

**Renders:** `Input`×8 (components/ui/input.tsx), `Image` (next/image), `Upload` (lucide-react), `Camera` (lucide-react), `Loader2` (lucide-react), `Button` (components/ui/button.tsx)

**Hooks used:** `useState`×4, `useRef`

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `default (ProfileSetupPage)` | component | `ProfileSetupPage()` | 269 |

## Interfaces

- **Backend endpoints called (via `/backend`):**
  - `GET /backend/org/resolve-pincode?pincode=${encodeURIComponent(pincode)}` (L41)
- **Timers / queues:** `setTimeout` at L67

## Dependencies

- **Internal:**
  - `components/ui/button.tsx` — `Button`
  - `components/ui/input.tsx` — `Input`
  - `lib/api.ts` — `api`
- **Packages:**
  - `react` — `useState`, `useRef`
  - `next`
  - `lucide-react` — `Camera`, `Upload`, `Loader2`

## Used by

Entry: reached by the Next.js router at `/profile-setup` (page).
