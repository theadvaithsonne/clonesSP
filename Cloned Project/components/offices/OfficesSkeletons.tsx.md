# `components/offices/OfficesSkeletons.tsx`

> React components `SkeletonBar`, `ChipRowSkeleton`, `LoadingMessage`, `OfficesPageSkeleton`.

**Kind:** React component · **Lines:** 139 · **Directive:** `"use client"`

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Composition

**Renders:** `SkeletonBar`×15 (local), `SectionHeadingSkeleton`×2 (local), `OfficeSwitcherSkeleton`×2 (components/offices/OfficeCard.tsx), `ChipRowSkeleton`×2 (local), `OfficeCardSkeleton`×2 (components/offices/OfficeCard.tsx), `Image` (next/image), `Atmosphere` (components/offices/ui.tsx), `TopBarSkeleton` (local), `LoadingMessage` (local)

### Props

- **`SkeletonBar`**: `className?: string`, `style?: React.CSSProperties`
- **`OfficesPageSkeleton`**: `variant: "hub" | "list" | "mine"`

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `SkeletonBar` | component | `SkeletonBar({ className, style }: { className?: string; style?: React.C…)` — One placeholder bar, in the design's loading colour. | 10 |
| `ChipRowSkeleton` | component | `ChipRowSkeleton()` | 16 |
| `LoadingMessage` | component | `LoadingMessage()` — "Finding offices worth your time…" under a loading grid. | 36 |
| `OfficesPageSkeleton` | component | `OfficesPageSkeleton({ variant }: { variant: "hub" \| "list" \| "mine" })` — The whole Offices page while the member and their offices load, shaped like the screen that's coming: the hub, a list, or "My offices". | 67 |

## Interfaces

None detected: no endpoints, events, data access or environment reads were found.

## Dependencies

- **Internal:**
  - `lib/utils.ts` — `cn`
  - `components/offices/OfficeCard.tsx` — `OfficeCardSkeleton`, `OfficeSwitcherSkeleton`
  - `components/offices/ui.tsx` — `Atmosphere`
- **Packages:**
  - `react`
  - `next`

## Used by

- `app/select-organization/page.tsx`
- `components/offices/CategoryNav.tsx`
- `components/offices/FeaturedOffices.tsx`
- `components/offices/HubSections.tsx`
- `components/offices/OfficeGridView.tsx`
- `components/offices/OfficeSearchPalette.tsx`
