# `components/garage-admin/AccessGrid.tsx`

> The per-page access editor.

**Kind:** React component · **Lines:** 317 · **Directive:** `"use client"`

<!-- docgen:auto -->

## Purpose
The per-page access editor. Each delegatable page reads as a section — a
bold title + description with a master toggle on the right (grant access
on/off). When on, an indented panel shows Create / Update / Delete columns:
  - a "Full access" row whose C/U/D checkmarks light up when the admin can
    manage the page (create, update & delete), and
  - for pages that split their writes (e.g. One Time Affiliates: assign
    agent vs. mark NVC), one toggle row per action.

The C/U/D marks are a read-only display of what a grant covers — the model
enforces at the page/action level (manage = all writes), so they light up
together. Three underlying states are preserved: master off = None, master
on + Full off = View (read-only), Full on = Full (manage).

Shared by AdminAccessMatrix (invite) and the Roles & Access page.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Composition

**Renders:** `Switch`×3 (local), `CrudCell`×3 (local), `Check` (lucide-react)

### Props

- **`AccessGrid`**: `catalogue: AdminPageCatalogue`, `permissions: Record<string, AdminPageLevel>`, `onPermissionsChange: (next: Record<string, AdminPageLevel>) => void`, `className?: string`

**Hooks used:** `useMemo`

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `default (AccessGrid)` | component | `AccessGrid({ catalogue, permissions, onPermissionsChange, className, }…)` | 96 |

## Interfaces

None detected: no endpoints, events, data access or environment reads were found.

## Dependencies

- **Internal:**
  - `lib/utils.ts` — `cn`
  - `lib/admin-api/permissions.ts` — `actionKey`, `countGranted`, `AdminPage`, `AdminPageCatalogue`, `AdminPageLevel`
- **Packages:**
  - `react` — `useMemo`
  - `lucide-react` — `Check`

## Used by

- `app/garage-admin/(admin-dashboard)/roles/page.tsx`
- `components/garage-admin/AdminAccessMatrix.tsx`
