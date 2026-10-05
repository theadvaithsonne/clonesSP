# `app/garage-admin/(admin-dashboard)/networkchains/earngpt-learning/page.tsx`

> Next.js page rendered at `/garage-admin/networkchains/earngpt-learning`.

**Kind:** Next.js page · **Lines:** 286 · **Directive:** `"use client"` · **Route:** `/garage-admin/networkchains/earngpt-learning` (page)

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Composition

**Renders:** `DataTable` (components/data-table/DataTable.tsx), `TableTopBar` (components/data-table/TableTopBar.tsx), `ExportButton` (components/data-table/ExportPanel.tsx), `AppliedFilterChips` (components/data-table/AppliedFilterChips.tsx), `ExportPanel` (components/data-table/ExportPanel.tsx)

**Hooks used:** `useState`×9, `useCallback`×2, `useRef`, `useEffect`, `useMemo`

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `default (EarnGPTLearningPage)` | component | `EarnGPTLearningPage()` | 71 |

## Interfaces

None detected: no endpoints, events, data access or environment reads were found.

## Dependencies

- **Internal:**
  - `components/data-table/DataTable.tsx` — `DataTable`
  - `components/data-table/TableTopBar.tsx` — `TableTopBar`, `TopBarView`
  - `components/data-table/AppliedFilterChips.tsx` — `AppliedFilterChips`, `FilterChip`
  - `components/data-table/types.ts` — `ColumnDef`, `(types only)`
  - `components/data-table/ExportPanel.tsx` — `ExportPanel`, `ExportButton`, `ExportField`
  - `lib/nc-admin-api/admin.ts` — `getSuggestionFeedback`, `AdminUnauthorizedError`, `AdminSuggestionFeedbackItem`
  - `lib/nc-admin-api/auth.ts` — `ensureNcAdminToken`
- **Packages:**
  - `react` — `useCallback`, `useEffect`, `useMemo`, `useRef`, `useState`

## Used by

Entry: reached by the Next.js router at `/garage-admin/networkchains/earngpt-learning` (page).
