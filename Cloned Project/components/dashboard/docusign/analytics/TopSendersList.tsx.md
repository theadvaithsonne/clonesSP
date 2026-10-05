# `components/dashboard/docusign/analytics/TopSendersList.tsx`

> React component `TopSendersList`.

**Kind:** React component · **Lines:** 49 · **Directive:** `"use client"`

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Composition

**Renders:** `Avatar` (components/ui/data-table/cells.tsx)

### Props

- **`TopSendersList`**: `senders: DsAnalyticsSummary["topSenders"] | null`, `loading?: boolean`

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `TopSendersList` | component | `TopSendersList({ senders, loading }: { senders: DsAnalyticsSummary["topSen…)` | 6 |

## Interfaces

None detected: no endpoints, events, data access or environment reads were found.

## Dependencies

- **Internal:**
  - `components/ui/data-table/cells.tsx` — `Avatar`
  - `lib/docusign/types.ts` — `DsAnalyticsSummary`, `(types only)`
- **Packages:** none

## Used by

- `components/dashboard/docusign/DocusignDashboardView.tsx`
