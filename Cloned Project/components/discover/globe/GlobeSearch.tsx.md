# `components/discover/globe/GlobeSearch.tsx`

> React component `GlobeSearch`.

**Kind:** React component · **Lines:** 231 · **Directive:** `"use client"`

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Composition

**Renders:** `Search` (lucide-react), `X` (lucide-react), `Image` (next/image), `Building2` (lucide-react), `MapPin` (lucide-react)

### Props

- **`GlobeSearch`**: `hqOrganizations: HQOrganization[]`, `founders: NewFounder[]`, `stakeholders: Stakeholder[]`, `activeTab: TabType`, `onResultClick: (entity: SearchableEntity) => void`

**Hooks used:** `useState`×3, `useRef`×2, `useEffect`×2

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `GlobeSearch` | component | `GlobeSearch({ hqOrganizations, founders, stakeholders, activeTab, onRes…)` | 24 |

## Interfaces

None detected: no endpoints, events, data access or environment reads were found.

## Dependencies

- **Internal:**
  - `components/discover/globe/types.ts` — `HQOrganization`, `NewFounder`, `Stakeholder`, `TabType`, `(types only)`
  - `components/discover/globe/types.ts` — `getEntityLocation`, `isValidCoordinate`
- **Packages:**
  - `react` — `useState`, `useRef`, `useEffect`
  - `next`
  - `lucide-react` — `Search`, `X`, `Building2`, `MapPin`

## Used by

- `components/discover/globe/GlobeView.tsx`
