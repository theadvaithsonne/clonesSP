# `app/garage-admin/(admin-dashboard)/platform-fees/page.tsx`

> Next.js page rendered at `/garage-admin/platform-fees`.

**Kind:** Next.js page · **Lines:** 748 · **Directive:** `"use client"` · **Route:** `/garage-admin/platform-fees` (page)

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Composition

**Renders:** `Button`×4 (components/ui/button.tsx), `Sparkles`×3 (lucide-react), `Building2`×3 (lucide-react), `Search`×2 (lucide-react), `Input`×2 (components/ui/input.tsx), `FeeRowCard`×2 (local), `TrendingUp`×2 (lucide-react), `TrendingDown`×2 (lucide-react), `Info`×2 (lucide-react), `Loader2`×2 (lucide-react), `RotateCcw`×2 (lucide-react), `Card` (components/ui/card.tsx), `CardContent` (components/ui/card.tsx), `Percent` (lucide-react), `X` (lucide-react), `Dialog` (components/ui/dialog.tsx), `DialogContent` (components/ui/dialog.tsx), `DialogHeader` (components/ui/dialog.tsx), `DialogTitle` (components/ui/dialog.tsx), `DialogDescription` (components/ui/dialog.tsx), `Label` (components/ui/label.tsx), `DialogFooter` (components/ui/dialog.tsx), `AlertDialog` (components/ui/alert-dialog.tsx), `AlertDialogContent` (components/ui/alert-dialog.tsx), `AlertDialogHeader` (components/ui/alert-dialog.tsx), `AlertDialogTitle` (components/ui/alert-dialog.tsx), `AlertDialogDescription` (components/ui/alert-dialog.tsx), `AlertDialogFooter` (components/ui/alert-dialog.tsx), `AlertDialogCancel` (components/ui/alert-dialog.tsx), `AlertDialogAction` (components/ui/alert-dialog.tsx), `Pencil` (lucide-react)

**Hooks used:** `useState`×11, `useEffect`×2, `useMemo`×2, `useAdminSearch` (components/garage-admin/admin-search.tsx)

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `default (PlatformFeesPage)` | component | `PlatformFeesPage()` | 81 |

## Interfaces

- **garage-admin API called (`my.revenue.network`):**
  - `GET /garage-admin/platform-fee-overrides` (L107)
  - `PUT /garage-admin/platform-fee-overrides/${editing.orgId}` (L189)
  - `DELETE /garage-admin/platform-fee-overrides/${resetTarget.orgId}` (L217)
- **Timers / queues:** `setTimeout` at L101

## Dependencies

- **Internal:**
  - `lib/api.ts` — `garageAdminApi`
  - `components/garage-admin/admin-search.tsx` — `useAdminSearch`
  - `components/ui/card.tsx` — `Card`, `CardContent`, `CardDescription`, `CardHeader`, `CardTitle`
  - `components/ui/input.tsx` — `Input`
  - `components/ui/label.tsx` — `Label`
  - `components/ui/button.tsx` — `Button`
  - `components/ui/dialog.tsx` — `Dialog`, `DialogContent`, `DialogDescription`, `DialogFooter`, `DialogHeader`, `DialogTitle`
  - `components/ui/alert-dialog.tsx` — `AlertDialog`, `AlertDialogAction`, `AlertDialogCancel`, `AlertDialogContent`, `AlertDialogDescription`, `AlertDialogFooter`, `AlertDialogHeader`, `AlertDialogTitle`
  - `lib/utils.ts` — `cn`
- **Packages:**
  - `react` — `useEffect`, `useMemo`, `useState`
  - `lucide-react` — `Building2`, `Search`, `Percent`, `Pencil`, `RotateCcw`, `Loader2`, …
  - `sonner` — `toast`

## Used by

Entry: reached by the Next.js router at `/garage-admin/platform-fees` (page).
