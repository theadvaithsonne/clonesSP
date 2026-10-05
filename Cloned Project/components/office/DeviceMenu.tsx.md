# `components/office/DeviceMenu.tsx`

> React component `DeviceMenu`.

**Kind:** React component · **Lines:** 131 · **Directive:** `"use client"`

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Composition

**Renders:** `ChevronUp` (lucide-react)

### Props

- **`DeviceMenu`**: `kind: 'audioinput' | 'videoinput'`, `ariaLabel: string`

**Hooks used:** `useMediaDeviceSelect` (@livekit/components-react), `useState`, `useRef`, `useEffect`

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `default (DeviceMenu)` | component | `DeviceMenu({ kind, ariaLabel, }: { kind: 'audioinput' \| 'videoinput'; …)` | 48 |

## Interfaces

None detected: no endpoints, events, data access or environment reads were found.

## Dependencies

- **Internal:**
  - `lib/utils.ts` — `cn`
- **Packages:**
  - `react` — `useEffect`, `useRef`, `useState`
  - `lucide-react` — `ChevronUp`
  - `@livekit/components-react` — `useMediaDeviceSelect`

## Used by

- `app/meet/conference/[orgId]/[roomId]/ConferenceCallStandalone.tsx`
