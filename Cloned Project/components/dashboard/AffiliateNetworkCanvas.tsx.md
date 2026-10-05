# `components/dashboard/AffiliateNetworkCanvas.tsx`

> React component `AffiliateNetworkCanvas`.

**Kind:** React component · **Lines:** 732 · **Directive:** `"use client"`

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Composition

**Renders:** `Button`×7 (components/ui/button.tsx), `Badge`×3 (components/ui/badge.tsx), `Users`×2 (lucide-react), `Card` (components/ui/card.tsx), `Avatar` (components/ui/avatar.tsx), `AvatarImage` (components/ui/avatar.tsx), `AvatarFallback` (components/ui/avatar.tsx), `Calendar` (lucide-react), `DollarSign` (lucide-react), `ChevronRight` (lucide-react), `ArrowUp` (lucide-react), `ArrowLeft` (lucide-react), `ArrowDown` (lucide-react), `ArrowRight` (lucide-react), `ZoomIn` (lucide-react), `ZoomOut` (lucide-react), `Move` (lucide-react)

### Props

- **`AffiliateNetworkCanvas`**: `networkData: AffiliateNode | null`, `loading?: boolean`

**Hooks used:** `useState`×7, `useRef`×3, `useEffect`×2

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `AffiliateNetworkCanvas` | component | `AffiliateNetworkCanvas({ networkData, loading, }: AffiliateNetworkCanvasProps)` | 58 |

## Interfaces

- **Timers / queues:** `setInterval` at L229
- **External hosts mentioned in the code:** `api.dicebear.com`

## Dependencies

- **Internal:**
  - `components/ui/avatar.tsx` — `Avatar`, `AvatarFallback`, `AvatarImage`
  - `components/ui/card.tsx` — `Card`
  - `components/ui/button.tsx` — `Button`
  - `components/ui/badge.tsx` — `Badge`
- **Packages:**
  - `react` — `useRef`, `useState`, `useEffect`
  - `lucide-react` — `ZoomIn`, `ZoomOut`, `Move`, `Users`, `DollarSign`, `Calendar`, …

## Used by

- `components/dashboard/AffiliatePage.tsx`
