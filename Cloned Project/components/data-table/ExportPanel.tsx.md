# `components/data-table/ExportPanel.tsx`

> React components `ExportPanel`, `ExportButton`.

**Kind:** React component · **Lines:** 203 · **Directive:** `"use client"`

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Composition

**Renders:** `Loader2`×2 (lucide-react), `FormDrawer` (components/ui/form-drawer.tsx), `Button` (components/ui/button.tsx), `ChevronRight` (lucide-react), `Check` (lucide-react), `Upload` (lucide-react)

### Props

- **`ExportPanel`**: `open: boolean`, `onOpenChange: (o: boolean) => void`, `fields: ExportField<T>[]`, `fetchAll: () => Promise<T[]>`, `filenameBase: string`
- **`ExportButton`**: `onClick: () => void`

**Hooks used:** `useState`×3, `useEffect`

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `ExportField` | interface | One exportable column: a stable key, a display label, an optional visual indent (sub-item under the row above it), and a CSV value accessor. | 11 |
| `ExportPanel` | component | `ExportPanel({ open, onOpenChange, fields, fetchAll, filenameBase, }: { …)` — The shared Export side panel used across every table (Rolodex, Downline, and the admin tables). | 45 |
| `ExportButton` | component | `ExportButton({ onClick }: { onClick: () => void })` — Small shared trigger for the top bar's `actions` slot — an Upload icon that opens the Export panel (mirrors the Rolodex export button). | 190 |

## Interfaces

None detected: no endpoints, events, data access or environment reads were found.

## Dependencies

- **Internal:**
  - `components/ui/form-drawer.tsx` — `FormDrawer`
  - `components/ui/button.tsx` — `Button`
  - `lib/utils.ts` — `cn`
- **Packages:**
  - `react` — `useEffect`, `useState`
  - `lucide-react` — `ChevronRight`, `Loader2`, `Check`, `Upload`

## Used by

- `app/garage-admin/(admin-dashboard)/networkchains/axons/page.tsx`
- `app/garage-admin/(admin-dashboard)/networkchains/earngpt-learning/page.tsx`
- `app/garage-admin/(admin-dashboard)/networkchains/offerings/page.tsx`
- `app/garage-admin/(admin-dashboard)/networkchains/sentry/page.tsx`
- `app/garage-admin/(admin-dashboard)/networkchains/subscriptions/page.tsx`
- `app/garage-admin/(admin-dashboard)/networkchains/users/page.tsx`
