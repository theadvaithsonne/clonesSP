# `components/dashboard/docusign/DocusignDashboardView.tsx`

> React component `DocusignDashboardView`.

**Kind:** React component · **Lines:** 93 · **Directive:** `"use client"`

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Composition

**Renders:** `KpiCard`×4 (components/dashboard/docusign/analytics/KpiCard.tsx), `DateRangeToggle` (components/dashboard/docusign/analytics/DateRangeToggle.tsx), `DocumentStatusDonut` (components/dashboard/docusign/analytics/DocumentStatusDonut.tsx), `SigningActivityChart` (components/dashboard/docusign/analytics/SigningActivityChart.tsx), `TopSendersList` (components/dashboard/docusign/analytics/TopSendersList.tsx), `RecentDocumentsTable` (components/dashboard/docusign/analytics/RecentDocumentsTable.tsx)

### Props

- **`DocusignDashboardView`**: `onOpen: (doc: DsDocument | DsExternalDocument, kind?: "internal" | "e…`, `onViewAll: () => void`

**Hooks used:** `useEffect`×2, `useDocusignStore` (store/docusign/docusignStore.ts), `useState`, `useRef`

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `DocusignDashboardView` | component | `DocusignDashboardView({ onOpen, onViewAll }: DocusignDashboardViewProps)` | 21 |

## Interfaces

None detected: no endpoints, events, data access or environment reads were found.

## Dependencies

- **Internal:**
  - `store/docusign/docusignStore.ts` — `useDocusignStore`
  - `components/dashboard/docusign/analytics/DateRangeToggle.tsx` — `DateRangeToggle`
  - `components/dashboard/docusign/analytics/KpiCard.tsx` — `KpiCard`
  - `components/dashboard/docusign/analytics/DocumentStatusDonut.tsx` — `DocumentStatusDonut`
  - `components/dashboard/docusign/analytics/SigningActivityChart.tsx` — `SigningActivityChart`
  - `components/dashboard/docusign/analytics/TopSendersList.tsx` — `TopSendersList`
  - `components/dashboard/docusign/analytics/RecentDocumentsTable.tsx` — `RecentDocumentsTable`
  - `lib/docusign/types.ts` — `DsAnalyticsRange`, `(types only)`
  - `lib/docusign/internal-api.ts` — `DsDocument`, `(types only)`
  - `lib/docusign/external-api.ts` — `DsExternalDocument`, `(types only)`
- **Packages:**
  - `react` — `useEffect`, `useRef`, `useState`

## Used by

- `components/dashboard/docusign/DocusignPage.tsx`
