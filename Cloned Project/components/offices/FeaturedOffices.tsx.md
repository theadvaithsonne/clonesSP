# `components/offices/FeaturedOffices.tsx`

> React components `GrowthNote`, `FeaturedOffices`, `FeaturedOfficesSkeleton`.

**Kind:** React component · **Lines:** 155 · **Directive:** `"use client"`

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Composition

**Renders:** `SkeletonBar`×5 (components/offices/OfficesSkeletons.tsx), `Pill`×2 (components/offices/ui.tsx), `TrendingUp` (lucide-react), `FeaturedCard` (local), `OfficeCover` (components/offices/OfficeCard.tsx), `PillButton` (components/offices/ui.tsx), `ArrowUpRight` (lucide-react), `GrowthNote` (local)

### Props

- **`GrowthNote`**: `joins: number`, `days: number`
- **`FeaturedOffices`**: `offices: TrendingOffice[]`, `days: number`, `isMember: (officeId: string) => boolean`, `onOpen: (office: TrendingOffice) => void`

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `GrowthNote` | component | `GrowthNote({ joins, days }: { joins: number; days: number })` — "+141 this week" — people who joined the office in the window. | 12 |
| `FeaturedOffices` | component | `FeaturedOffices({ offices, days, isMember, onOpen, }: { offices: TrendingOf…)` — The week's most-joined offices: a wide lead card and a narrower runner-up. | 21 |
| `FeaturedOfficesSkeleton` | component | `FeaturedOfficesSkeleton()` | 130 |

## Interfaces

None detected: no endpoints, events, data access or environment reads were found.

## Dependencies

- **Internal:**
  - `lib/utils.ts` — `cn`
  - `lib/discover-api.ts` — `TrendingOffice`, `(types only)`
  - `components/offices/OfficeCard.tsx` — `OfficeCover`
  - `components/offices/OfficesSkeletons.tsx` — `SkeletonBar`
  - `components/offices/ui.tsx` — `Pill`, `PillButton`, `formatCount`
- **Packages:**
  - `react`
  - `lucide-react` — `ArrowUpRight`, `TrendingUp`

## Used by

- `app/select-organization/page.tsx`
