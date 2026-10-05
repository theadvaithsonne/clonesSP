# `components/dashboard/FounderCouponsPage.tsx`

> React component `FounderCouponsPage`.

**Kind:** React component · **Lines:** 957 · **Directive:** `"use client"`

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Composition

**Renders:** `Label`×11 (components/ui/label.tsx), `Button`×7 (components/ui/button.tsx), `Input`×7 (components/ui/input.tsx), `Tag`×3 (lucide-react), `Icon`×3 (local), `Check`×3 (lucide-react), `Users`×3 (lucide-react), `Gift`×2 (lucide-react), `Plus`×2 (lucide-react), `Edit2`×2 (lucide-react), `Percent`×2 (lucide-react), `Target`×2 (lucide-react), `Loader2`×2 (lucide-react), `TrendingUp`×2 (lucide-react), `Power`×2 (lucide-react), `Dialog` (components/ui/dialog.tsx), `DialogTrigger` (components/ui/dialog.tsx), `DialogContent` (components/ui/dialog.tsx), `DialogHeader` (components/ui/dialog.tsx), `DialogTitle` (components/ui/dialog.tsx), `Sparkles` (lucide-react), `DialogDescription` (components/ui/dialog.tsx), `Zap` (lucide-react), `Calendar` (lucide-react), `Infinity` (lucide-react), `DialogFooter` (components/ui/dialog.tsx), `Copy` (lucide-react), `Badge` (components/ui/badge.tsx), `Clock` (lucide-react), `PowerOff` (lucide-react), `Trash2` (lucide-react)

**Hooks used:** `useState`×10, `useEffect`×2

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `default (FounderCouponsPage)` | component | `FounderCouponsPage()` | 102 |

## Interfaces

- **Backend endpoints called (via `/backend`):**
  - `GET /backend/org/${orgId}/coupons` (L149)
  - `GET /backend/org/${orgId}/coupons/available-items?types=${types.join(",")}` (L173)
  - `PATCH /backend/org/${orgId}/coupons/${editingCoupon._id}` (L222)
  - `POST /backend/org/${orgId}/coupons` (L229)
  - `PATCH /backend/org/${orgId}/coupons/${coupon._id}` (L255)
  - `DELETE /backend/org/${orgId}/coupons/${couponId}` (L275)
- **Timers / queues:** `setTimeout` at L325

## Dependencies

- **Internal:**
  - `lib/api.ts` — `api`
  - `lib/auth.ts` — `getToken`
  - `components/ui/button.tsx` — `Button`
  - `components/ui/input.tsx` — `Input`
  - `components/ui/label.tsx` — `Label`
  - `components/ui/badge.tsx` — `Badge`
  - `components/ui/dialog.tsx` — `Dialog`, `DialogContent`, `DialogDescription`, `DialogFooter`, `DialogHeader`, `DialogTitle`, `DialogTrigger`
  - `lib/utils.ts` — `cn`
- **Packages:**
  - `react` — `useState`, `useEffect`
  - `lucide-react` — `Tag`, `Plus`, `Percent`, `Users`, `Trash2`, `Edit2`, …
  - `sonner` — `toast`

## Used by

- `components/dashboard/ManagementPage.tsx`
