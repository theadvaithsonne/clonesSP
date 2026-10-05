# `components/coverfi/corporate/CorporateList.tsx`

> React component `CorporateList`.

**Kind:** React component · **Lines:** 195 · **Directive:** `"use client"`

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Composition

**Renders:** `TableCell`×9 (components/ui/table.tsx), `TableHead`×7 (components/ui/table.tsx), `TableRow`×4 (components/ui/table.tsx), `Landmark`×2 (lucide-react), `Link`×2 (next/link), `Button`×2 (components/ui/button.tsx), `Badge`×2 (components/ui/badge.tsx), `PageHeader` (components/coverfi/PageHeader.tsx), `Plus` (lucide-react), `Table` (components/ui/table.tsx), `TableHeader` (components/ui/table.tsx), `TableBody` (components/ui/table.tsx), `CodeChip` (local), `Trash2` (lucide-react), `Check` (lucide-react), `Copy` (lucide-react)

**Hooks used:** `useState`×3, `useEffect`

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `default (CorporateList)` | component | `CorporateList()` | 24 |

## Interfaces

- **Timers / queues:** `setTimeout` at L174

## Dependencies

- **Internal:**
  - `components/ui/button.tsx` — `Button`
  - `components/ui/badge.tsx` — `Badge`
  - `components/ui/table.tsx` — `Table`, `TableBody`, `TableCell`, `TableHead`, `TableHeader`, `TableRow`
  - `components/coverfi/PageHeader.tsx` — `PageHeader (default)`
  - `lib/coverfi/corporate-api.ts` — `listCorporates`, `deleteCorporate`
  - `lib/coverfi/types.ts` — `Corporate`, `(types only)`
- **Packages:**
  - `react` — `useEffect`, `useState`
  - `next`
  - `lucide-react` — `Plus`, `Trash2`, `Landmark`, `Copy`, `Check`
  - `sonner` — `toast`

## Used by

- `app/(dashboard)/coverfi/corporate/page.tsx`
