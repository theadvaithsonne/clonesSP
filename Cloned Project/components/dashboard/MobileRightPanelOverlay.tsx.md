# `components/dashboard/MobileRightPanelOverlay.tsx`

> React component `MobileRightPanelOverlay`.

**Kind:** React component · **Lines:** 91 · **Directive:** `"use client"`

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Composition

**Renders:** `AnimatePresence` (framer-motion), `RightPanel` (components/dashboard/RightPanel.tsx)

### Props

- **`MobileRightPanelOverlay`**: `activeChatId: { type: "dm" | "group" | "global-dm"; id: string }`, `setActiveChatId: (v: { type: "dm" | "group" | "global-dm"; id: string…`, `setActivePopover: (v: string | null) => void`, `className?: string`

**Hooks used:** `useMobileSidebar` (lib/mobile-sidebar-context.tsx), `useEffect`

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `default (MobileRightPanelOverlay)` | component | `MobileRightPanelOverlay({ activeChatId, setActiveChatId, setActivePopover, classNam…)` | 18 |

## Interfaces

None detected: no endpoints, events, data access or environment reads were found.

## Dependencies

- **Internal:**
  - `lib/mobile-sidebar-context.tsx` — `useMobileSidebar`
  - `components/dashboard/RightPanel.tsx` — `RightPanel (default)`
- **Packages:**
  - `react` — `useEffect`
  - `framer-motion` — `AnimatePresence`, `motion`

## Used by

- `app/(dashboard)/layout.tsx`
