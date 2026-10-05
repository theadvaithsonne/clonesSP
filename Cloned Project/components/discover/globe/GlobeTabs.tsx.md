# `components/discover/globe/GlobeTabs.tsx`

> React component `GlobeTabs`.

**Kind:** React component · **Lines:** 65 · **Directive:** `"use client"`

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Composition

**Renders:** `Building2` (lucide-react), `Users` (lucide-react), `UserCheck` (lucide-react)

### Props

- **`GlobeTabs`**: `activeTab: TabType`, `onTabChange: (tab: TabType) => void`, `counts?: { hqs: number; founders: number; stakeholders: number; }`

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `GlobeTabs` | component | `GlobeTabs({ activeTab, onTabChange, counts }: GlobeTabsProps)` | 16 |

## Interfaces

None detected: no endpoints, events, data access or environment reads were found.

## Dependencies

- **Internal:**
  - `components/discover/globe/types.ts` — `TabType`, `(types only)`
- **Packages:**
  - `lucide-react` — `Building2`, `Users`, `UserCheck`

## Used by

- `components/discover/globe/GlobeView.tsx`
