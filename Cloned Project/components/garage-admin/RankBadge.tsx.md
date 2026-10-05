# `components/garage-admin/RankBadge.tsx`

> Shared rank + status pills for the Rank Bonus admin surface.

**Kind:** React component · **Lines:** 113 · **Directive:** `"use client"`

<!-- docgen:auto -->

## Purpose
Shared rank + status pills for the Rank Bonus admin surface.

Colours follow the metal each rank is named after so a table of hundreds of
rows is scannable at a glance without reading the label.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Props

- **`RankBadge`**: `rank?: string | null`, `size?: "sm" | "md"`
- **`ActivePill`**: `active: boolean`
- **`SubReasonPill`**: `reason: string`
- **`PayoutStatusPill`**: `status: string`

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `RankBadge` | component | `RankBadge({ rank, size = "sm", }: { rank?: string \| null; size?: "sm"…)` | 16 |
| `ActivePill` | component | `ActivePill({ active }: { active: boolean })` | 43 |
| `SubReasonPill` | component | `SubReasonPill({ reason }: { reason: string })` — Why someone is inactive — the answer to "but I paid". | 63 |
| `PayoutStatusPill` | component | `PayoutStatusPill({ status }: { status: string })` | 92 |

## Interfaces

None detected: no endpoints, events, data access or environment reads were found.

## Dependencies

- **Internal:** none
- **Packages:** none

## Used by

- `app/garage-admin/(admin-dashboard)/rank-bonus/page.tsx`
- `components/garage-admin/RankPersonDrawer.tsx`
