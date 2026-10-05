# `components/dashboard/CouponRulesTab.tsx`

> React component `CouponRulesTab`.

**Kind:** React component · **Lines:** 447 · **Directive:** `"use client"`

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Composition

**Renders:** `Zap`×2 (lucide-react), `Plus`×2 (lucide-react), `Tv` (lucide-react), `GraduationCap` (lucide-react), `BookOpen` (lucide-react), `ShoppingBag` (lucide-react), `Sparkles` (lucide-react), `Phone` (lucide-react), `Building2` (lucide-react), `Layers` (lucide-react), `Network` (lucide-react), `Info` (lucide-react), `Loader2` (lucide-react), `Repeat` (lucide-react), `Edit2` (lucide-react), `Trash2` (lucide-react), `CouponRuleEditor` (components/dashboard/CouponRuleEditor.tsx)

### Props

- **`CouponRulesTab`**: `rulesEndpoint: string`, `itemsEndpoint: string`, `couponsEndpoint: string`, `authToken: string`, `scope: CouponRuleScope`

**Hooks used:** `useState`×4, `useCallback`, `useEffect`

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `CouponRuleProductType` | type |  | 27 |
| `CouponRuleScope` | type |  | 40 |
| `CouponRule` | interface |  | 42 |
| `CouponRulesTab` | component | `CouponRulesTab({ rulesEndpoint, itemsEndpoint, couponsEndpoint, authToken,…)` | 95 |

## Interfaces

- **Backend endpoints called (via `/backend`):**
  - `GET /backend/${rulesEndpoint}` (L110)
  - `PATCH /backend/${rulesEndpoint}/${rule._id}` (L132)
  - `DELETE /backend/${rulesEndpoint}/${rule._id}` (L156)

## Dependencies

- **Internal:**
  - `lib/utils.ts` — `cn`
  - `lib/api.ts` — `API_URL`
  - `components/dashboard/CouponRuleEditor.tsx` — `CouponRuleEditor`
- **Packages:**
  - `react` — `useEffect`, `useState`, `useCallback`
  - `lucide-react` — `Plus`, `Loader2`, `Sparkles`, `Trash2`, `Edit2`, `Repeat`, …
  - `sonner` — `toast`

## Used by

- `app/garage-admin/(admin-dashboard)/platform-coupons/page.tsx`
- `components/dashboard/CouponRuleEditor.tsx`
- `components/dashboard/FounderPlatformCouponsPage.tsx`
