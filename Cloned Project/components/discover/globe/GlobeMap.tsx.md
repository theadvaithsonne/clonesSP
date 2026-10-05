# `components/discover/globe/GlobeMap.tsx`

> React component `GlobeMap`.

**Kind:** React component · **Lines:** 425 · **Directive:** `"use client"`

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Props

- **`GlobeMap`**: `hqOrganizations: HQOrganization[]`, `founders: NewFounder[]`, `stakeholders: Stakeholder[]`, `activeTab: TabType`, `isSpinning: boolean`, `onEntityClick: (entity: EntityType) => void`, `onViewHQ?: (org: HQOrganization) => void`, `onViewFounder?: (founder: NewFounder) => void`, `onViewStakeholder?: (stakeholder: Stakeholder) => void`, `mapRef?: React.MutableRefObject<mapboxgl.Map | null>`

**Hooks used:** `useRef`×7, `useEffect`×5, `useCallback`×3, `useState`

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `GlobeMap` | component | `GlobeMap({ hqOrganizations, founders, stakeholders, activeTab, isSpi…)` | 28 |

## Interfaces

- **Environment variables (`process.env`):** `NEXT_PUBLIC_MAPBOX_TOKEN`

## Dependencies

- **Internal:**
  - `components/discover/globe/types.ts` — `HQOrganization`, `NewFounder`, `Stakeholder`, `TabType`, `EntityType`, `(types only)`
  - `components/discover/globe/types.ts` — `isValidCoordinate`, `getEntityLocation`, `isHQOrganization`
- **Packages:**
  - `react` — `useEffect`, `useRef`, `useCallback`, `useState`
  - `mapbox-gl`

## Used by

- `components/discover/globe/GlobeView.tsx`
