# `components/dashboard/liveStreams/DrawerShell.tsx`

> The docked right-hand drawer every Live Streams panel sits in.

**Kind:** React component · **Lines:** 230 · **Directive:** `"use client"`

<!-- docgen:auto -->

## Purpose
The docked right-hand drawer every Live Streams panel sits in.

Shared rather than copied because the Options drawer and the Switch View
panel are the same object to a founder — they open from the same table, sit
in the same place, and are navigated with the same back button. When the
shell lived in both files they drifted: one kept a floating rounded card
while the other was docked, and the two circular header buttons ended up
with different hover states.

Docked, not floating: full height, flush to the right edge, square corners,
one hairline border on the left. A floating panel with a margin reads as a
modal — something you dismiss — where this is a workspace you act in.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Composition

**Renders:** `CircleButton`×2 (local), `DrawerCard`×2 (local), `AnimatePresence` (framer-motion), `ArrowLeft` (lucide-react), `X` (lucide-react), `Search` (lucide-react)

### Props

- **`DrawerShell`**: `open: boolean`, `title: string`, `onBack: () => void`, `onClose: () => void`, `searching?: boolean`, `onToggleSearch?: () => void`, `searchValue?: string`, `onSearchChange?: (v: string) => void`, `searchPlaceholder?: string`, `loading?: boolean`, `skeleton?: ReactNode`, `children: ReactNode`
- **`DrawerCard`**: `children: ReactNode`
- **`DrawerListSkeleton`**: `rows?: number`
- **`SeriesPickerSkeleton`**: `rows?: number`

**Hooks used:** `useEffect`

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `DrawerShell` | component | `DrawerShell({ open, title, onBack, onClose, searching, onToggleSearch, …)` | 23 |
| `DrawerCard` | component | `DrawerCard({ children }: { children: ReactNode })` — The rounded, divided card every panel groups its rows into. | 171 |
| `DrawerListSkeleton` | component | `DrawerListSkeleton({ rows = 9 }: { rows?: number })` — The nine-ish action rows, as placeholders. | 190 |
| `SeriesPickerSkeleton` | component | `SeriesPickerSkeleton({ rows = 5 }: { rows?: number })` — The recurring-series picker, as placeholders: a search field above five avatar rows. | 212 |

## Interfaces

None detected: no endpoints, events, data access or environment reads were found.

## Dependencies

- **Internal:** none
- **Packages:**
  - `react` — `ReactNode`, `useEffect`
  - `framer-motion` — `AnimatePresence`, `motion`
  - `lucide-react` — `ArrowLeft`, `Search`, `X`

## Used by

- `components/dashboard/liveStreams/EditSessionSheet.tsx`
- `components/dashboard/liveStreams/LiveStreamOptionsDrawer.tsx`
- `components/dashboard/liveStreams/SwitchViewPanel.tsx`
