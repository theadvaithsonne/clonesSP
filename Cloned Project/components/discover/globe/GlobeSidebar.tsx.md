# `components/discover/globe/GlobeSidebar.tsx`

> React component `GlobeSidebar`.

**Kind:** React component · **Lines:** 321 · **Directive:** `"use client"`

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Composition

**Renders:** `Image`×4 (next/image), `MapPin`×2 (lucide-react), `ChevronDown`×2 (lucide-react), `ChevronRight`×2 (lucide-react), `Building2`×2 (lucide-react), `X` (lucide-react)

### Props

- **`GlobeSidebar`**: `isOpen: boolean`, `onClose: () => void`, `countryGroups: CountryGroup[]`, `activeTab: TabType`, `onEntityClick: (entity: EntityType) => void`, `onCountryClick: (country: CountryGroup) => void`, `embedded?: boolean`

**Hooks used:** `useState`

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `GlobeSidebar` | component | `GlobeSidebar({ isOpen, onClose, countryGroups, activeTab, onEntityClick,…)` | 26 |

## Interfaces

- **External hosts mentioned in the code:** `flagcdn.com`

## Dependencies

- **Internal:**
  - `components/discover/globe/types.ts` — `CountryGroup`, `EntityType`, `HQOrganization`, `NewFounder`, `Stakeholder`, `TabType`, `(types only)`
  - `components/discover/globe/types.ts` — `getEntityLocation`, `isHQOrganization`
- **Packages:**
  - `react` — `useState`
  - `next`
  - `lucide-react` — `ChevronDown`, `ChevronRight`, `X`, `Building2`, `MapPin`

## Used by

- `components/discover/globe/GlobeView.tsx`
