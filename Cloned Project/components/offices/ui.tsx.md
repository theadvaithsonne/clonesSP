# `components/offices/ui.tsx`

> React components `Atmosphere`, `BackLink`, `Eyebrow`, `SectionHeading` and 4 more.

**Kind:** React component · **Lines:** 297 · **Directive:** `"use client"`

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Composition

**Renders:** `ArrowLeft`×2 (lucide-react), `ArrowRight`×2 (lucide-react), `PillButton`×2 (local), `Eyebrow` (local)

### Props

- **`BackLink`**: `onClick: () => void`, `label?: string`
- **`Eyebrow`**: `children: React.ReactNode`, `className?: string`
- **`SectionHeading`**: `eyebrow?: React.ReactNode`, `title: React.ReactNode`, `action?: { label: string; onClick: () => void }`
- **`Pill`**: `tone?: PillTone`, `children: React.ReactNode`, `className?: string`

**Hooks used:** `useState`

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `formatCount` | function | `formatCount(n: number): string` — 12840 -> "12.8k", 950 -> "950". | 19 |
| `membersLabel` | function | `membersLabel(count: number \| undefined): string \| null` | 25 |
| `initials` | function | `initials(name: string \| undefined, max = 2): string` | 30 |
| `isNewOffice` | function | `isNewOffice(createdAt: string \| undefined): boolean` | 42 |
| `joinedLabel` | function | `joinedLabel(joinedAt: string \| undefined): string \| null` | 48 |
| `Atmosphere` | component | `Atmosphere()` — The warm glow and star specks behind every Offices screen. | 58 |
| `BackLink` | component | `BackLink({ onClick, label = "Offices" }: { onClick: () => void; labe…)` — "← Offices" above a sub-view's title, back to the Offices home. | 81 |
| `Eyebrow` | component | `Eyebrow({ children, className }: { children: React.ReactNode; class…)` | 94 |
| `SectionHeading` | component | `SectionHeading({ eyebrow, title, action, }: { eyebrow?: React.ReactNode; t…)` | 102 |
| `Pill` | component | `Pill({ tone = "accent", children, className, }: { tone?: PillTon…)` | 139 |
| `PillButton` | component | `React.forwardRef< HTMLButtonElement, React.ButtonHTMLAttributes<HTMLButtonElement> & { va…` | 169 |
| `OfficeEmblem` | component | `OfficeEmblem({ name, icon, className, textClassName, letters = 1, }: { n…)` — An office's mark: its uploaded icon when it has one, otherwise its initial on the accent square. | 191 |
| `Pagination` | component | `Pagination({ page, totalPages, onPage, }: { page: number; totalPages: …)` | 249 |

## Interfaces

None detected: no endpoints, events, data access or environment reads were found.

## Dependencies

- **Internal:**
  - `lib/utils.ts` — `cn`
- **Packages:**
  - `react` — `useState`
  - `lucide-react` — `ArrowLeft`, `ArrowRight`

## Used by

- `app/select-organization/page.tsx`
- `components/offices/FeaturedOffices.tsx`
- `components/offices/HubSections.tsx`
- `components/offices/JoinOfficeDialog.tsx`
- `components/offices/MyOfficesView.tsx`
- `components/offices/OfficeCard.tsx`
- `components/offices/OfficeGridView.tsx`
- `components/offices/OfficeSearchPalette.tsx`
- `components/offices/OfficesSkeletons.tsx`
- `components/offices/OfficesTopBar.tsx`
