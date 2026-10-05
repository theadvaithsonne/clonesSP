# `components/offices/OfficeCard.tsx`

> React components `OfficeCard`, `OfficeCover`, `OfficeCardSkeleton`, `FindOfficeCard` and 3 more.

**Kind:** React component · **Lines:** 328 · **Directive:** `"use client"`

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Composition

**Renders:** `OfficeCover` (local), `Pill` (components/offices/ui.tsx), `OfficeEmblem` (components/offices/ui.tsx), `ArrowUpRight` (lucide-react), `LogoCover` (local), `CoverFallback` (local), `Plus` (lucide-react), `PillButton` (components/offices/ui.tsx), `Clock` (lucide-react), `Loader2` (lucide-react), `ChevronRight` (lucide-react), `CirclePlus` (lucide-react)

### Props

- **`OfficeCard`**: `office: OfficeCardData`, `onOpen: () => void`, `footer?: React.ReactNode`, `highlighted?: boolean`
- **`OfficeCover`**: `office: OfficeCardData`, `logoClassName?: string`
- **`FindOfficeCard`**: `onExplore: () => void`
- **`OfficeSwitcherCard`**: `name: string`, `icon?: string`, `subtitle: string`, `current?: boolean`, `pending?: boolean`, `loading?: boolean`, `disabled?: boolean`, `onSelect: () => void`

**Hooks used:** `useState`×2

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `OfficeCardData` | type | What an office card needs; `/discover/organizations` rows fit as-is. | 9 |
| `OfficeCard` | component | `OfficeCard({ office, onOpen, footer, highlighted, }: { office: OfficeC…)` — A discoverable office: cover, emblem, name, members · category, and a description. | 28 |
| `OfficeCover` | component | `OfficeCover({ office, logoClassName, }: { office: OfficeCardData; /** S…)` — The card's cover, from the office's own images: its cover photo, else its logo as a blurred wash with the mark on top, else the lettered stand-in. | 118 |
| `OfficeCardSkeleton` | component | `OfficeCardSkeleton()` | 198 |
| `FindOfficeCard` | component | `FindOfficeCard({ onExplore }: { onExplore: () => void })` — The accent tile that sits after your own offices. | 214 |
| `OfficeSwitcherCard` | component | `OfficeSwitcherCard({ name, icon, subtitle, current, pending, loading, disabled…)` — One office in the "Your offices" one-click switcher. | 230 |
| `JoinAnotherOfficeTile` | component | `JoinAnotherOfficeTile({ onClick }: { onClick: () => void })` | 304 |
| `OfficeSwitcherSkeleton` | component | `OfficeSwitcherSkeleton()` | 317 |

## Interfaces

None detected: no endpoints, events, data access or environment reads were found.

## Dependencies

- **Internal:**
  - `lib/utils.ts` — `cn`
  - `components/offices/ui.tsx` — `OfficeEmblem`, `Pill`, `PillButton`, `initials`, `isNewOffice`, `membersLabel`
- **Packages:**
  - `react` — `useState`
  - `lucide-react` — `ArrowUpRight`, `ChevronRight`, `Clock`, `Loader2`, `Plus`, `CirclePlus`

## Used by

- `app/select-organization/page.tsx`
- `components/offices/FeaturedOffices.tsx`
- `components/offices/JoinOfficeDialog.tsx`
- `components/offices/MyOfficesView.tsx`
- `components/offices/OfficeGridView.tsx`
- `components/offices/OfficesSkeletons.tsx`
