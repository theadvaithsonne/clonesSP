# `components/dashboard/docusign/analytics/RecentDocumentsTable.tsx`

> React component `RecentDocumentsTable`.

**Kind:** React component · **Lines:** 307 · **Directive:** `"use client"`

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Composition

**Renders:** `TitleCell`×2 (local), `StatusBadge`×2 (components/dashboard/docusign/shared/StatusBadge.tsx), `DataTable`×2 (components/ui/data-table/DataTable.tsx), `SearchExportBar`×2 (local), `TabButton`×2 (local), `Search` (lucide-react), `Download` (lucide-react), `FileText` (lucide-react), `Avatar` (components/ui/data-table/cells.tsx), `InternalTable` (local), `ExternalTable` (local)

### Props

- **`RecentDocumentsTable`**: `onOpen: (doc: DsDocument | DsExternalDocument, kind: Tab) => void`

**Hooks used:** `useState`×11, `useEffect`×2, `useMemo`×2

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `RecentDocumentsTable` | component | `RecentDocumentsTable({ onOpen }: { onOpen: (doc: DsDocument \| DsExternalDocument…)` | 287 |

## Interfaces

None detected: no endpoints, events, data access or environment reads were found.

## Dependencies

- **Internal:**
  - `components/ui/data-table/DataTable.tsx` — `DataTable`
  - `components/ui/data-table/cells.tsx` — `Avatar`
  - `components/ui/data-table/types.ts` — `ColumnDef`, `(types only)`
  - `components/dashboard/docusign/shared/StatusBadge.tsx` — `StatusBadge`
  - `lib/utils.ts` — `cn`
  - `lib/docusign/internal-api.ts` — `DsDocument`, `listAllInOrg`
  - `lib/docusign/external-api.ts` — `DsExternalDocument`, `listMyExternalDocuments`
- **Packages:**
  - `react` — `useEffect`, `useMemo`, `useState`
  - `lucide-react` — `Download`, `FileText`, `Search`

## Used by

- `components/dashboard/docusign/DocusignDashboardView.tsx`
