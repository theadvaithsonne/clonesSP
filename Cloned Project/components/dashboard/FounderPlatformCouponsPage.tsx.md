# `components/dashboard/FounderPlatformCouponsPage.tsx`

> React component `FounderPlatformCouponsPage`.

**Kind:** React component · **Lines:** 1739 · **Directive:** `"use client"`

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Composition

**Renders:** `Label`×15 (components/ui/label.tsx), `TableHead`×8 (components/ui/table.tsx), `TableCell`×8 (components/ui/table.tsx), `Button`×5 (components/ui/button.tsx), `TicketPercent`×3 (lucide-react), `Search`×3 (lucide-react), `Loader2`×3 (lucide-react), `Gift`×2 (lucide-react), `TableRow`×2 (components/ui/table.tsx), `Sheet`×2 (components/ui/sheet.tsx), `SheetContent`×2 (components/ui/sheet.tsx), `SheetHeader`×2 (components/ui/sheet.tsx), `SheetTitle`×2 (components/ui/sheet.tsx), `SheetDescription`×2 (components/ui/sheet.tsx), `X`×2 (lucide-react), `Calendar`×2 (lucide-react), `Receipt`×2 (lucide-react), `Tv` (lucide-react), `GraduationCap` (lucide-react), `BookOpen` (lucide-react), `ShoppingBag` (lucide-react), `Sparkles` (lucide-react), `Phone` (lucide-react), `CouponRulesTab` (components/dashboard/CouponRulesTab.tsx), `Card` (components/ui/card.tsx), `CardHeader` (components/ui/card.tsx), `CardTitle` (components/ui/card.tsx), `CardDescription` (components/ui/card.tsx), `Plus` (lucide-react), `CardContent` (components/ui/card.tsx), `Layers` (lucide-react), `Zap` (lucide-react), `Activity` (lucide-react), `Table` (components/ui/table.tsx), `TableHeader` (components/ui/table.tsx), `TableBody` (components/ui/table.tsx), `Check` (lucide-react), `Copy` (lucide-react), `Eye` (lucide-react), `Edit2` (lucide-react), … +10 more

**Hooks used:** `useState`×23, `useEffect`×3, `useMemo`×3

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `default (FounderPlatformCouponsPage)` | component | `FounderPlatformCouponsPage()` | 229 |

## Interfaces

- **Backend endpoints called (via `/backend`):**
  - `GET /backend/org/${orgId}/platform-coupons${q}` (L315)
  - `GET /backend/org/${orgId}/coupon-eligible-items?productType=${form.productType}` (L373)
  - `GET /backend/org/${orgId}/coupon-eligible-items?productType=${c.productType}` (L427)
  - `GET /backend/org/${orgId}/platform-coupons/${c._id}/redemptions` (L451)
  - `PATCH /backend/org/${orgId}/platform-coupons/${editing._id}` (L539)
  - `POST /backend/org/${orgId}/platform-coupons` (L546)
  - `POST /backend/org/${orgId}/platform-coupons/${c._id}/${action}` (L570)
- **Timers / queues:** `setTimeout` at L585

## Dependencies

- **Internal:**
  - `lib/api.ts` — `api`
  - `lib/auth.ts` — `getToken`
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
- **Packages:**
  - `react` — `useState`, `useEffect`, `useMemo`
  - `lucide-react` — `TicketPercent`, `Plus`, `Loader2`, `Power`, `PowerOff`, `Edit2`, …
  - `sonner` — `toast`

## Used by

- `components/dashboard/ManagementPage.tsx`

## Notes

- Large file (1739 lines) — read it by section; line numbers above point into it.
