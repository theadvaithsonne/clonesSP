# `components/dashboard/inlineApps/network-mail/campaign-table.tsx`

> React component `CampaignTable`.

**Kind:** React component · **Lines:** 441 · **Directive:** `"use client"`

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Composition

**Renders:** `CampaignStatusBadge`×2 (local), `CampaignRowActions`×2 (local), `CampaignTableFooter`×2 (local), `Clock` (lucide-react), `Pencil` (lucide-react), `Copy` (lucide-react), `Trash2` (lucide-react), `CampaignMobileCard` (local)

### Props

- **`CampaignTable`**: `campaigns: CampaignRow[]`, `total?: number`, `page?: number`, `onPageChange?: (page: number) => void`, `onRowClick?: (campaign: CampaignRow) => void`, `onEdit?: (id: string) => void`, `onDuplicate?: (id: string) => void`, `onDelete?: (id: string) => void`, `loading?: boolean`

**Hooks used:** `useEffect`×2, `useState`, `useMemo`

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `CampaignStatus` | type |  | 8 |
| `CampaignRow` | interface |  | 16 |
| `CampaignTable` | component | `CampaignTable({ campaigns, total: totalProp, page: pageProp, onPageChange…)` | 256 |

## Interfaces

None detected: no endpoints, events, data access or environment reads were found.

## Dependencies

- **Internal:** none
- **Packages:**
  - `react` — `useEffect`, `useMemo`, `useState`
  - `lucide-react` — `Clock`, `Copy`, `Pencil`, `Trash2`

## Used by

- `components/dashboard/inlineApps/network-mail/NetworkMailApp.tsx`
- `components/dashboard/inlineApps/network-mail/campaign-details-view.tsx`
