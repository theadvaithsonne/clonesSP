# `components/dashboard/docusign/shared/SimplePagination.tsx`

> React component `SimplePagination`.

**Kind:** React component · **Lines:** 49 · **Directive:** `"use client"`

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Composition

**Renders:** `ChevronLeft` (lucide-react), `ChevronRight` (lucide-react)

### Props

- **`SimplePagination`**: `props: PaginationProps`

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `SimplePagination` | component | `SimplePagination({ page, totalPages, rangeLabel, onPrev, onNext }: Paginatio…)` | 11 |
| `paginationRangeLabel` | function | `paginationRangeLabel(pagination: { page: number; limit: number; total: number })` | 43 |

## Interfaces

None detected: no endpoints, events, data access or environment reads were found.

## Dependencies

- **Internal:**
  - `components/ui/data-table/types.ts` — `PaginationProps`, `(types only)`
- **Packages:**
  - `lucide-react` — `ChevronLeft`, `ChevronRight`

## Used by

- `components/dashboard/docusign/external/ExternalSignaturesList.tsx`
- `components/dashboard/docusign/internal/AgreementsView.tsx`
- `components/dashboard/docusign/internal/DocumentsList.tsx`
- `components/dashboard/docusign/shared/TemplatesList.tsx`
- `components/dashboard/docusign/shared/admin/MembersTab.tsx`
