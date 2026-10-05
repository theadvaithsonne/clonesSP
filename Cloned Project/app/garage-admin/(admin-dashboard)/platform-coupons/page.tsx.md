# `app/garage-admin/(admin-dashboard)/platform-coupons/page.tsx`

> Next.js page rendered at `/garage-admin/platform-coupons`.

**Kind:** Next.js page · **Lines:** 1438 · **Directive:** `"use client"` · **Route:** `/garage-admin/platform-coupons` (page)

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Composition

**Renders:** `Label`×14 (components/ui/label.tsx), `Gift`×8 (lucide-react), `TableHead`×8 (components/ui/table.tsx), `TableCell`×8 (components/ui/table.tsx), `Button`×5 (components/ui/button.tsx), `TicketPercent`×3 (lucide-react), `TableRow`×2 (components/ui/table.tsx), `Sheet`×2 (components/ui/sheet.tsx), `SheetContent`×2 (components/ui/sheet.tsx), `SheetHeader`×2 (components/ui/sheet.tsx), `SheetTitle`×2 (components/ui/sheet.tsx), `SheetDescription`×2 (components/ui/sheet.tsx), `X`×2 (lucide-react), `Info`×2 (lucide-react), `Calendar`×2 (lucide-react), `Loader2`×2 (lucide-react), `Receipt`×2 (lucide-react), `Building2` (lucide-react), `Sparkles` (lucide-react), `TrendingUp` (lucide-react), `Store` (lucide-react), `MapPin` (lucide-react), `CouponRulesTab` (components/dashboard/CouponRulesTab.tsx), `Card` (components/ui/card.tsx), `CardHeader` (components/ui/card.tsx), `CardTitle` (components/ui/card.tsx), `CardDescription` (components/ui/card.tsx), `Plus` (lucide-react), `CardContent` (components/ui/card.tsx), `Table` (components/ui/table.tsx), `TableHeader` (components/ui/table.tsx), `TableBody` (components/ui/table.tsx), `Check` (lucide-react), `Copy` (lucide-react), `Eye` (lucide-react), `Edit2` (lucide-react), `PowerOff` (lucide-react), `Power` (lucide-react), `Clock` (lucide-react), `Users` (lucide-react), … +6 more

**Hooks used:** `useState`×16, `useEffect`×2, `useAdminAccess` (components/garage-admin/use-admin-access.ts), `useAdminSearch` (components/garage-admin/admin-search.tsx), `useMemo`

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `default (PlatformCouponsPage)` | component | `PlatformCouponsPage()` | 262 |

## Interfaces

- **garage-admin API called (`my.revenue.network`):**
  - `GET /garage-admin/platform-coupons${suffix}` (L343)
  - `GET /garage-admin/platform-coupons/${c._id}/redemptions` (L418)
  - `PATCH /garage-admin/platform-coupons/${editing._id}` (L495)
  - `POST /garage-admin/platform-coupons` (L501)
  - `POST /garage-admin/platform-coupons/${c._id}/${action}` (L521)
- **Browser storage / cookies:** `garage_admin_token` (localStorage: get)
- **Timers / queues:** `setTimeout` at L332, L535

## Dependencies

- **Internal:**
  - `lib/admin-domain.ts` — `invoiceUrl`
  - `lib/api.ts` — `garageAdminApi`
  - `components/garage-admin/admin-search.tsx` — `useAdminSearch`
  - `components/dashboard/CouponAssignmentSheet.tsx` — `CouponAssignmentSheet`
  - `components/dashboard/CouponRulesTab.tsx` — `CouponRulesTab`
  - `components/ui/button.tsx` — `Button`
  - `components/ui/card.tsx` — `Card`, `CardContent`, `CardDescription`, `CardHeader`, `CardTitle`
  - `components/ui/table.tsx` — `Table`, `TableBody`, `TableCell`, `TableHead`, `TableHeader`, `TableRow`
  - `components/ui/badge.tsx` — `Badge`
  - `components/ui/input.tsx` — `Input`
  - `components/ui/label.tsx` — `Label`
  - `components/ui/sheet.tsx` — `Sheet`, `SheetContent`, `SheetHeader`, `SheetTitle`, `SheetDescription`, `SheetFooter`
  - `lib/utils.ts` — `cn`
  - `components/garage-admin/use-admin-access.ts` — `useAdminAccess`
- **Packages:**
  - `react` — `useState`, `useEffect`, `useMemo`
  - `lucide-react` — `TicketPercent`, `Plus`, `Loader2`, `Power`, `PowerOff`, `Edit2`, …
  - `sonner` — `toast`

## Used by

Entry: reached by the Next.js router at `/garage-admin/platform-coupons` (page).
