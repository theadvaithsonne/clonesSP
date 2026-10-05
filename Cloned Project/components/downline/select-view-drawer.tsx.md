# `components/downline/select-view-drawer.tsx`

> The "Select View" right-side drawer — opened by the "As A Shopper" (role) and "Digital/Physical" (product type) switcher pills on the one-time-affiliate profile page.

**Kind:** React component · **Lines:** 119 · **Directive:** `"use client"`

<!-- docgen:auto -->

## Purpose
The "Select View" right-side drawer — opened by the "As A Shopper" (role) and
"Digital/Physical" (product type) switcher pills on the one-time-affiliate
profile page. Both use this same panel with a different option set.
`{name}` in a description is replaced with the member's name.
Ported verbatim from NetworkChains' components/downline/select-view-drawer.tsx.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Composition

**Renders:** `X` (lucide-react), `Search` (lucide-react), `Icon` (local), `Check` (lucide-react)

### Props

- **`SelectViewDrawer`**: `open: boolean`, `options: ViewOption[]`, `selectedId: string`, `memberName?: string`, `onSelect: (id: string) => void`, `onClose: () => void`

**Hooks used:** `useEffect`

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `ViewOption` | type |  | 14 |
| `SelectViewDrawer` | component | `SelectViewDrawer({ open, options, selectedId, memberName, onSelect, onClose,…)` | 22 |

## Interfaces

None detected: no endpoints, events, data access or environment reads were found.

## Dependencies

- **Internal:** none
- **Packages:**
  - `react` — `useEffect`
  - `lucide-react` — `X`, `Search`, `Check`

## Used by

- `components/garage-admin/member-profile-view.tsx`
