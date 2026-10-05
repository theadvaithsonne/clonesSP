# `app/garage-admin/(admin-dashboard)/coupons/page.tsx`

> Next.js page rendered at `/garage-admin/coupons`.

**Kind:** Next.js page · **Lines:** 1032 · **Directive:** `"use client"` · **Route:** `/garage-admin/coupons` (page)

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Composition

**Renders:** `Label`×10 (components/ui/label.tsx), `Input`×8 (components/ui/input.tsx), `Button`×7 (components/ui/button.tsx), `TableHead`×7 (components/ui/table.tsx), `TableCell`×7 (components/ui/table.tsx), `Card`×6 (components/ui/card.tsx), `CardContent`×6 (components/ui/card.tsx), `Tag`×4 (lucide-react), `Badge`×4 (components/ui/badge.tsx), `Icon`×3 (local), `Plus`×2 (lucide-react), `Percent`×2 (lucide-react), `Loader2`×2 (lucide-react), `Check`×2 (lucide-react), `Info`×2 (lucide-react), `Power`×2 (lucide-react), `TableRow`×2 (components/ui/table.tsx), `Gift` (lucide-react), `Dialog` (components/ui/dialog.tsx), `DialogTrigger` (components/ui/dialog.tsx), `DialogContent` (components/ui/dialog.tsx), `DialogHeader` (components/ui/dialog.tsx), `Sparkles` (lucide-react), `DialogTitle` (components/ui/dialog.tsx), `DialogDescription` (components/ui/dialog.tsx), `DialogFooter` (components/ui/dialog.tsx), `TrendingUp` (lucide-react), `CardHeader` (components/ui/card.tsx), `CardTitle` (components/ui/card.tsx), `CardDescription` (components/ui/card.tsx), `Table` (components/ui/table.tsx), `TableHeader` (components/ui/table.tsx), `TableBody` (components/ui/table.tsx), `Copy` (lucide-react), `Users` (lucide-react), `Calendar` (lucide-react), `Edit2` (lucide-react), `PowerOff` (lucide-react), `Trash2` (lucide-react)

**Hooks used:** `useState`×10, `useEffect`×2, `useAdminAccess` (components/garage-admin/use-admin-access.ts), `useAdminSearch` (components/garage-admin/admin-search.tsx)

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `default (CouponsPage)` | component | `CouponsPage()` | 125 |

## Interfaces

- **garage-admin API called (`my.revenue.network`):**
  - `GET /garage-admin/coupons${suffix}` (L172)
  - `GET /garage-admin/coupons/available-items?types=${types.join(",")}` (L192)
  - `PATCH /garage-admin/coupons/${editingCoupon._id}` (L239)
  - `POST /garage-admin/coupons` (L245)
  - `PATCH /garage-admin/coupons/${coupon._id}` (L267)
  - `DELETE /garage-admin/coupons/${couponId}` (L283)
- **Timers / queues:** `setTimeout` at L158, L340

## Dependencies

- **Internal:**
  - `lib/api.ts` — `garageAdminApi`
  - `components/garage-admin/admin-search.tsx` — `useAdminSearch`
  - `components/ui/button.tsx` — `Button`
  - `components/ui/card.tsx` — `Card`, `CardContent`, `CardDescription`, `CardHeader`, `CardTitle`
  - `components/ui/table.tsx` — `Table`, `TableBody`, `TableCell`, `TableHead`, `TableHeader`, `TableRow`
  - `components/ui/badge.tsx` — `Badge`
  - `components/ui/input.tsx` — `Input`
  - `components/ui/label.tsx` — `Label`
  - `components/ui/dialog.tsx` — `Dialog`, `DialogContent`, `DialogDescription`, `DialogFooter`, `DialogHeader`, `DialogTitle`, `DialogTrigger`
  - `lib/utils.ts` — `cn`
  - `components/garage-admin/use-admin-access.ts` — `useAdminAccess`
- **Packages:**
  - `react` — `useState`, `useEffect`
  - `lucide-react` — `Tag`, `Plus`, `Percent`, `Calendar`, `Users`, `Trash2`, …
  - `sonner` — `toast`

## Used by

Entry: reached by the Next.js router at `/garage-admin/coupons` (page).
