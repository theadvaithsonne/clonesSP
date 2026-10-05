# `components/dashboard/CouponAssignmentSheet.tsx`

> React component `CouponAssignmentSheet`.

**Kind:** React component · **Lines:** 320 · **Directive:** `"use client"`

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Composition

**Renders:** `Label`×4 (components/ui/label.tsx), `Gift`×2 (lucide-react), `Loader2`×2 (lucide-react), `Sheet` (components/ui/sheet.tsx), `SheetContent` (components/ui/sheet.tsx), `SheetHeader` (components/ui/sheet.tsx), `SheetTitle` (components/ui/sheet.tsx), `SheetDescription` (components/ui/sheet.tsx), `X` (lucide-react), `UserSearchPicker` (components/ui/user-search-picker.tsx), `Calendar` (lucide-react), `Trash2` (lucide-react)

### Props

- **`CouponAssignmentSheet`**: `open: boolean`, `onOpenChange: (open: boolean) => void`, `couponId: string | null`, `couponCode?: string`, `couponName?: string`, `endpointBase: string`, `authToken: string`, `scope: "platform" | "org"`, `orgId?: string`

**Hooks used:** `useState`×6, `useCallback`, `useEffect`

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `CouponAssignmentSheetProps` | interface |  | 19 |
| `CouponAssignmentSheet` | component | `CouponAssignmentSheet({ open, onOpenChange, couponId, couponCode, couponName, end…)` | 50 |

## Interfaces

- **Backend endpoints called (via `/backend`):**
  - `GET /backend/${url}/assignments` (L74)
  - `POST /backend/${url}/assignments` (L99)
  - `DELETE /backend/${revokeUrl}` (L143)

## Dependencies

- **Internal:**
  - `components/ui/sheet.tsx` — `Sheet`, `SheetContent`, `SheetHeader`, `SheetTitle`, `SheetDescription`
  - `components/ui/label.tsx` — `Label`
  - `components/ui/user-search-picker.tsx` — `UserSearchPicker`, `PickedUser`
  - `lib/utils.ts` — `cn`
  - `lib/api.ts` — `API_URL`
- **Packages:**
  - `react` — `useState`, `useEffect`, `useCallback`
  - `lucide-react` — `Loader2`, `Gift`, `X`, `Trash2`, `Calendar`
  - `sonner` — `toast`

## Used by

- `app/garage-admin/(admin-dashboard)/platform-coupons/page.tsx`
- `components/dashboard/FounderPlatformCouponsPage.tsx`
