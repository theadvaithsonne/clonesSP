# `app/garage-admin/(admin-dashboard)/categories/page.tsx`

> Next.js page rendered at `/garage-admin/categories`.

**Kind:** Next.js page · **Lines:** 554 · **Directive:** `"use client"` · **Route:** `/garage-admin/categories` (page)

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Composition

**Renders:** `Button`×9 (components/ui/button.tsx), `Loader2`×4 (lucide-react), `StatCard`×3 (local), `Input`×3 (components/ui/input.tsx), `Dialog`×3 (components/ui/dialog.tsx), `DialogContent`×3 (components/ui/dialog.tsx), `DialogHeader`×3 (components/ui/dialog.tsx), `DialogTitle`×3 (components/ui/dialog.tsx), `DialogDescription`×3 (components/ui/dialog.tsx), `Label`×3 (components/ui/label.tsx), `DialogFooter`×3 (components/ui/dialog.tsx), `Trash2`×2 (lucide-react), `Tag` (lucide-react), `Plus` (lucide-react), `Card` (components/ui/card.tsx), `CardHeader` (components/ui/card.tsx), `CardTitle` (components/ui/card.tsx), `CardDescription` (components/ui/card.tsx), `Search` (lucide-react), `CardContent` (components/ui/card.tsx), `Pencil` (lucide-react), `ArrowRight` (lucide-react)

**Hooks used:** `useState`×12, `useMemo`×2, `useAdminAccess` (components/garage-admin/use-admin-access.ts), `useCallback`, `useEffect`

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `default (OrgCategoriesAdminPage)` | component | `OrgCategoriesAdminPage()` | 50 |

## Interfaces

- **garage-admin API called (`my.revenue.network`):**
  - `GET /garage-admin/categories` (L79)
  - `POST /garage-admin/categories` (L130)
  - `PATCH /garage-admin/categories/${editRow.id}` (L158)
  - `DELETE /garage-admin/categories/${deleteRow.id}` (L188)

## Dependencies

- **Internal:**
  - `lib/api.ts` — `garageAdminApi`
  - `components/ui/card.tsx` — `Card`, `CardContent`, `CardDescription`, `CardHeader`, `CardTitle`
  - `components/ui/input.tsx` — `Input`
  - `components/ui/label.tsx` — `Label`
  - `components/ui/button.tsx` — `Button`
  - `components/ui/dialog.tsx` — `Dialog`, `DialogContent`, `DialogDescription`, `DialogFooter`, `DialogHeader`, `DialogTitle`
  - `lib/utils.ts` — `cn`
  - `components/garage-admin/use-admin-access.ts` — `useAdminAccess`
- **Packages:**
  - `react` — `useCallback`, `useEffect`, `useMemo`, `useState`
  - `lucide-react` — `Tag`, `Plus`, `Pencil`, `Trash2`, `Loader2`, `Search`, …
  - `sonner` — `toast`

## Used by

Entry: reached by the Next.js router at `/garage-admin/categories` (page).
