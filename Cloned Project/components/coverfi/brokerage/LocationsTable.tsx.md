# `components/coverfi/brokerage/LocationsTable.tsx`

> React component `LocationsTable`.

**Kind:** React component · **Lines:** 147 · **Directive:** `"use client"`

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Composition

**Renders:** `TableCell`×8 (components/ui/table.tsx), `TableHead`×6 (components/ui/table.tsx), `TableRow`×4 (components/ui/table.tsx), `Button`×3 (components/ui/button.tsx), `Plus` (lucide-react), `Table` (components/ui/table.tsx), `TableHeader` (components/ui/table.tsx), `TableBody` (components/ui/table.tsx), `Pencil` (lucide-react), `Trash2` (lucide-react), `LocationFormDialog` (components/coverfi/brokerage/LocationFormDialog.tsx)

**Hooks used:** `useState`×4, `useEffect`

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `default (LocationsTable)` | component | `LocationsTable()` | 22 |

## Interfaces

None detected: no endpoints, events, data access or environment reads were found.

## Dependencies

- **Internal:**
  - `components/ui/button.tsx` — `Button`
  - `components/ui/table.tsx` — `Table`, `TableBody`, `TableCell`, `TableHead`, `TableHeader`, `TableRow`
  - `components/coverfi/brokerage/LocationFormDialog.tsx` — `LocationFormDialog (default)`
  - `lib/coverfi/brokerage-api.ts` — `listLocations`, `deleteLocation`
  - `lib/coverfi/types.ts` — `BrokerageLocation`, `(types only)`
- **Packages:**
  - `react` — `useEffect`, `useState`
  - `lucide-react` — `Plus`, `Pencil`, `Trash2`
  - `sonner` — `toast`

## Used by

- `app/(dashboard)/coverfi/brokerage/locations/page.tsx`
