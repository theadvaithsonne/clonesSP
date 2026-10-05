# `components/shared/drawer-portal.tsx`

> React component `DrawerPortal`.

**Kind:** React component · **Lines:** 15 · **Directive:** `"use client"`

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Props

- **`DrawerPortal`**: `children: React.ReactNode`

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `DrawerPortal` | component | `DrawerPortal({ children }: { children: React.ReactNode })` — Renders children into <body> so fixed overlays escape any transformed / z-indexed ancestor stacking context — otherwise their z-index can't beat the global quick-add FAB (which lives at the layout root). | 11 |

## Interfaces

None detected: no endpoints, events, data access or environment reads were found.

## Dependencies

- **Internal:** none
- **Packages:**
  - `react-dom` — `createPortal`

## Used by

- `components/ui/form-drawer.tsx`
