# `components/dashboard/docusign/internal/DocumentsList.tsx`

> React component `DocumentsList`.

**Kind:** React component · **Lines:** 100 · **Directive:** `"use client"`

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Composition

**Renders:** `FileText`×2 (lucide-react), `RecipientChips` (local), `StatusBadge` (components/dashboard/docusign/shared/StatusBadge.tsx), `Button` (components/ui/button.tsx), `Download` (lucide-react), `SimplePagination` (components/dashboard/docusign/shared/SimplePagination.tsx)

### Props

- **`DocumentsList`**: `documents: DsDocument[]`, `emptyLabel: string`, `onOpen: (id: string) => void`, `pagination?: DsPagination`, `onPageChange?: (page: number) => void`

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `DocumentsList` | component | `DocumentsList({ documents, emptyLabel, onOpen, pagination, onPageChange }…)` | 47 |

## Interfaces

None detected: no endpoints, events, data access or environment reads were found.

## Dependencies

- **Internal:**
  - `lib/docusign/types.ts` — `DsPagination`
  - `lib/docusign/internal-api.ts` — `DsDocument`
  - `components/dashboard/docusign/shared/StatusBadge.tsx` — `StatusBadge`
  - `components/dashboard/docusign/shared/SimplePagination.tsx` — `SimplePagination`, `paginationRangeLabel`
  - `components/ui/button.tsx` — `Button`
  - `lib/utils.ts` — `cn`
- **Packages:**
  - `lucide-react` — `FileText`, `Download`

## Used by

- `components/dashboard/docusign/DocusignPage.tsx`
