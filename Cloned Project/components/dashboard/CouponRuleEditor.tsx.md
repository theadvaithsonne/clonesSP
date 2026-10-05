# `components/dashboard/CouponRuleEditor.tsx`

> React component `CouponRuleEditor`.

**Kind:** React component · **Lines:** 878 · **Directive:** `"use client"`

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Composition

**Renders:** `Sparkles`×4 (lucide-react), `Loader2`×3 (lucide-react), `ChevronDown`×2 (lucide-react), `Search`×2 (lucide-react), `Tv` (lucide-react), `GraduationCap` (lucide-react), `BookOpen` (lucide-react), `ShoppingBag` (lucide-react), `Phone` (lucide-react), `Building2` (lucide-react), `Layers` (lucide-react), `Network` (lucide-react), `Sheet` (components/ui/sheet.tsx), `SheetContent` (components/ui/sheet.tsx), `SheetHeader` (components/ui/sheet.tsx), `SheetTitle` (components/ui/sheet.tsx), `Zap` (lucide-react), `SheetDescription` (components/ui/sheet.tsx), `X` (lucide-react), `ItemPickerChip` (local), `Lock` (lucide-react), `CouponPickerChip` (local), `Info` (lucide-react)

### Props

- **`CouponRuleEditor`**: `open: boolean`, `onOpenChange: (open: boolean) => void`, `rulesEndpoint: string`, `itemsEndpoint: string`, `couponsEndpoint: string`, `authToken: string`, `scope: CouponRuleScope`, `editingRule: CouponRule | null`, `onSaved: () => void`

**Hooks used:** `useState`×15, `useEffect`×5, `useRef`×2, `useMemo`×2

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `CouponRuleEditor` | component | `CouponRuleEditor({ open, onOpenChange, rulesEndpoint, itemsEndpoint, coupons…)` | 97 |

## Interfaces

- **Backend endpoints called (via `/backend`):**
  - `GET /backend/${itemsEndpoint}` (L158)
  - `GET /backend/${couponsEndpoint}` (L174)
  - `PATCH /backend/${rulesEndpoint}/${editingRule._id}` (L297)
  - `POST /backend/${rulesEndpoint}` (L306)

## Dependencies

- **Internal:**
  - `components/ui/sheet.tsx` — `Sheet`, `SheetContent`, `SheetHeader`, `SheetTitle`, `SheetDescription`
  - `lib/utils.ts` — `cn`
  - `lib/api.ts` — `API_URL`
  - `components/dashboard/CouponRulesTab.tsx` — `CouponRule`, `CouponRuleProductType`, `CouponRuleScope`, `(types only)`
- **Packages:**
  - `react` — `useEffect`, `useState`, `useRef`, `useMemo`, `forwardRef`
  - `lucide-react` — `Loader2`, `X`, `ChevronDown`, `Search`, `Lock`, `Info`, …
  - `sonner` — `toast`

## Used by

- `components/dashboard/CouponRulesTab.tsx`
