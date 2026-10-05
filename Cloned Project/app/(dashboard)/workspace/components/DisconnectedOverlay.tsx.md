# `app/(dashboard)/workspace/components/DisconnectedOverlay.tsx`

> React component `DisconnectedOverlay`.

**Kind:** Next.js app-directory module (colocated) · **Lines:** 244 · **Directive:** `"use client"`

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Composition

**Renders:** `RefreshCw`×2 (lucide-react), `AnimatePresence` (framer-motion), `SignalIcon` (local), `Button` (components/ui/button.tsx)

### Props

- **`DisconnectedOverlay`**: `connectionState: ConnectionState`, `onReconnect: () => void`, `isReconnecting: boolean`

**Hooks used:** `useCallback`, `useEffect`

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `ConnectionState` | type |  | 9 |
| `DisconnectedOverlay` | component | `DisconnectedOverlay({ connectionState, onReconnect, isReconnecting, }: Disconne…)` | 109 |

## Interfaces

None detected: no endpoints, events, data access or environment reads were found.

## Dependencies

- **Internal:**
  - `components/ui/button.tsx` — `Button`
  - `lib/utils.ts` — `cn`
- **Packages:**
  - `lucide-react` — `RefreshCw`
  - `framer-motion` — `motion`, `AnimatePresence`
  - `react` — `useEffect`, `useCallback`

## Used by

No other file imports this one and it has no automatic entry point — it appears unused (or is loaded dynamically by a path the import graph cannot see).
