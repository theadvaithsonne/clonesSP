# `components/downline/profile-icons.tsx`

> Exact tab + dropdown icons, ported from the NetworkChains Figma design (node 1298:7005), used by the ported downline/one-time-affiliate profile page.

**Kind:** React component · **Lines:** 76

<!-- docgen:auto -->

## Purpose
Exact tab + dropdown icons, ported from the NetworkChains Figma design
(node 1298:7005), used by the ported downline/one-time-affiliate profile
page. Fills normalized to currentColor so active/inactive coloring is
driven by the parent's text color.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Composition

**Renders:** `ProfileIcon`×7 (local)

### Props

- **`ProfileIcon`**: `viewBox: string`, `className?: string`, `children: ReactNode`
- **`OfficesIcon`**: `className?: string`
- **`CommunitiesIcon`**: `className?: string`
- **`LiveStreamsIcon`**: `className?: string`

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `ProfileIcon` | component | `ProfileIcon({ viewBox, className, children, }: { viewBox: string; class…)` | 7 |
| `OfficesIcon` | component | `OfficesIcon({ className }: { className?: string })` | 21 |
| `CommunitiesIcon` | component | `CommunitiesIcon({ className }: { className?: string })` | 29 |
| `LiveStreamsIcon` | component | `LiveStreamsIcon({ className }: { className?: string })` | 37 |
| `CoursesIcon` | component | `CoursesIcon({ className }: { className?: string })` | 45 |
| `DigitalProductsIcon` | component | `DigitalProductsIcon({ className }: { className?: string })` | 53 |
| `PurchasesIcon` | component | `PurchasesIcon({ className }: { className?: string })` | 61 |
| `DigitalModeIcon` | component | `DigitalModeIcon({ className }: { className?: string })` | 69 |

## Interfaces

None detected: no endpoints, events, data access or environment reads were found.

## Dependencies

- **Internal:** none
- **Packages:**
  - `react` — `ReactNode`

## Used by

- `components/garage-admin/member-profile-view.tsx`
