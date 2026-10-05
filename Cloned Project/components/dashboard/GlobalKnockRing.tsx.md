# `components/dashboard/GlobalKnockRing.tsx`

> React component `GlobalKnockRing`.

**Kind:** React component · **Lines:** 255 · **Directive:** `"use client"`

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Composition

**Renders:** `Button`×2 (components/ui/button.tsx), `AnimatePresence` (framer-motion), `Check` (lucide-react), `X` (lucide-react)

### Props

- **`GlobalKnockRing`**: `myName?: string`

**Hooks used:** `useRef`×5, `usePathname` (next/navigation), `useRouter` (next/navigation), `useState`, `useEffect`

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `PENDING_KNOCK_ACCEPT_KEY` | const | `= "workspace:pending-knock-accept"` | 14 |
| `GlobalKnockRing` | component | `GlobalKnockRing({ myName }: { myName?: string })` — Dashboard-wide incoming-knock ring. | 36 |

## Interfaces

- **Socket.IO events:**
  - emits: `workspace:knock-decline`
  - listens for: `workspace:knock-request`, `workspace:knock-cancelled`, `workspace:knock-handled`, `livekit:call-answered-elsewhere`
- **Timers / queues:** `setTimeout` at L116

## Dependencies

- **Internal:**
  - `components/ui/button.tsx` — `Button`
  - `lib/socket.ts` — `connectSocket`
- **Packages:**
  - `react` — `useEffect`, `useRef`, `useState`
  - `next` — `usePathname`, `useRouter`
  - `framer-motion` — `AnimatePresence`, `motion`
  - `lucide-react` — `Check`, `X`

## Used by

- `app/(dashboard)/layout.tsx`
