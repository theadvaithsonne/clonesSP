# `components/offices/HubSections.tsx`

> React components `HubHero`, `GettingStartedCard`, `OfficesFooter`.

**Kind:** React component · **Lines:** 122 · **Directive:** `"use client"`

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Composition

**Renders:** `Eyebrow`×2 (components/offices/ui.tsx), `SkeletonBar`×2 (components/offices/OfficesSkeletons.tsx), `PillButton`×2 (components/offices/ui.tsx), `Link`×2 (next/link), `Compass` (lucide-react)

### Props

- **`HubHero`**: `officeTotal: number | null`, `loading: boolean`
- **`GettingStartedCard`**: `joined: number`, `goal: number`, `onDiscover: () => void`
- **`OfficesFooter`**: `onCreateOffice: () => void`

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `HubHero` | component | `HubHero({ officeTotal, loading }: { officeTotal: number \| null; loa…)` | 14 |
| `GettingStartedCard` | component | `GettingStartedCard({ joined, goal, onDiscover, }: { joined: number; goal: numb…)` — The new-member nudge: a ring showing how many of `goal` offices are joined. | 47 |
| `OfficesFooter` | component | `OfficesFooter({ onCreateOffice }: { onCreateOffice: () => void })` | 101 |

## Interfaces

None detected: no endpoints, events, data access or environment reads were found.

## Dependencies

- **Internal:**
  - `components/offices/OfficesSkeletons.tsx` — `SkeletonBar`
  - `components/offices/ui.tsx` — `Eyebrow`, `PillButton`
- **Packages:**
  - `react`
  - `next`
  - `lucide-react` — `Compass`

## Used by

- `app/select-organization/page.tsx`
