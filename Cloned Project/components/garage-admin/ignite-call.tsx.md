# `components/garage-admin/ignite-call.tsx`

> Ignite call status — the column cell.

**Kind:** React component · **Lines:** 133 · **Directive:** `"use client"`

<!-- docgen:auto -->

## Purpose
Ignite call status — the column cell.

The scheduling UI lives in catchup/IgniteCallScheduleDrawer.tsx (the ported
NetworkChains catch-up drawer) and the related-data panel in
IgniteCallDrawer.tsx. This file is just the cell and its two affordances.

Mirrors assign-agent.tsx: read-only for non-super admins. The link itself
lives on a neutral /garage-admin/users/:userId/ignite-call endpoint, so a
second admin table can adopt this column without a new backend.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Composition

**Renders:** `StatusBadge`×2 (local), `CalendarPlus` (lucide-react), `ChevronRight` (lucide-react)

### Props

- **`IgniteCallCell`**: `row: IgniteCallRow`, `onSchedule: (row: IgniteCallRow) => void`, `onOpenRelated: (row: IgniteCallRow) => void`, `canEdit: boolean`

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `IgniteCallRow` | type |  | 23 |
| `IgniteCallCell` | component | `IgniteCallCell({ row, onSchedule, onOpenRelated, canEdit, }: { row: Ignite…)` — The cell. Left-aligned like every other value in this admin panel. | 76 |

## Interfaces

None detected: no endpoints, events, data access or environment reads were found.

## Dependencies

- **Internal:**
  - `lib/admin-api/permissions.ts` — `isSuperAdminClient`
  - `lib/admin-api/ignite-call.ts` — `IGNITE_STATUS_LABEL`, `IgniteCallSummary`, `IgniteStatus`
- **Packages:**
  - `lucide-react` — `ChevronRight`, `CalendarPlus`
  - `sonner` — `toast`

## Used by

- `app/garage-admin/(admin-dashboard)/one-time-affiliates/page.tsx`
- `components/garage-admin/catchup/IgniteCallScheduleDrawer.tsx`
