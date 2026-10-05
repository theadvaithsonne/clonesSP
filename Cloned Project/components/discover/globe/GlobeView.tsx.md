# `components/discover/globe/GlobeView.tsx`

> React component `GlobeView`.

**Kind:** React component · **Lines:** 319 · **Directive:** `"use client"`

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Composition

**Renders:** `Menu`×2 (lucide-react), `GlobeTicker` (components/discover/globe/GlobeTicker.tsx), `GlobeTabs` (components/discover/globe/GlobeTabs.tsx), `GlobeSearch` (components/discover/globe/GlobeSearch.tsx), `GlobeSidebar` (components/discover/globe/GlobeSidebar.tsx), `GlobeMap` (components/discover/globe/GlobeMap.tsx), `GlobeControls` (components/discover/globe/GlobeControls.tsx), `X` (lucide-react)

**Hooks used:** `useCallback`×11, `useState`×3, `useRouter` (next/navigation), `useRef`, `useGlobeData` (lib/hooks/useGlobeData.ts)

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `GlobeView` | component | `GlobeView()` | 26 |

## Interfaces

None detected: no endpoints, events, data access or environment reads were found.

## Dependencies

- **Internal:**
  - `lib/hooks/useGlobeData.ts` — `useGlobeData`
  - `components/discover/globe/GlobeMap.tsx` — `GlobeMap`
  - `components/discover/globe/GlobeTabs.tsx` — `GlobeTabs`
  - `components/discover/globe/GlobeControls.tsx` — `GlobeControls`
  - `components/discover/globe/GlobeTicker.tsx` — `GlobeTicker`
  - `components/discover/globe/GlobeSearch.tsx` — `GlobeSearch`
  - `components/discover/globe/GlobeSidebar.tsx` — `GlobeSidebar`
  - `lib/utils.ts` — `slugify`
  - `components/discover/globe/types.ts` — `TabType`, `EntityType`, `TickerMessage`, `CountryGroup`, `HQOrganization`, `NewFounder`, `Stakeholder`, `(types only)`
  - `components/discover/globe/types.ts` — `isValidCoordinate`
- **Packages:**
  - `react` — `useState`, `useRef`, `useCallback`
  - `next` — `useRouter`
  - `mapbox-gl`
  - `lucide-react` — `Menu`, `X`

## Used by

- `components/discover/index.ts`
