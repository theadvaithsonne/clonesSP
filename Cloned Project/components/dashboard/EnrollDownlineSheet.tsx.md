# `components/dashboard/EnrollDownlineSheet.tsx`

> React component `EnrollDownlineSheet`.

**Kind:** React component · **Lines:** 761 · **Directive:** `"use client"`

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Composition

**Renders:** `Label`×7 (components/ui/label.tsx), `Input`×6 (components/ui/input.tsx), `Loader2`×4 (lucide-react), `Select`×3 (components/ui/select.tsx), `SelectTrigger`×3 (components/ui/select.tsx), `SelectValue`×3 (components/ui/select.tsx), `SelectContent`×3 (components/ui/select.tsx), `SelectItem`×3 (components/ui/select.tsx), `AlertCircle`×2 (lucide-react), `Check`×2 (lucide-react), `UserPlus` (lucide-react), `X` (lucide-react), `Sparkles` (lucide-react), `Building2` (lucide-react), `PhoneIcon` (lucide-react), `MapPin` (lucide-react)

### Props

- **`EnrollDownlineSheet`**: `open: boolean`, `onOpenChange: (open: boolean) => void`, `defaultOrgId?: string | null`, `onSuccess?: (result: { userId: string; email: string; orgName: string…`

**Hooks used:** `useState`×17, `useMemo`×5, `useEffect`×4, `useRef`×3

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `EnrollDownlineSheetOrg` | interface |  | 32 |
| `EnrollDownlineSheet` | component | `EnrollDownlineSheet({ open, onOpenChange, defaultOrgId, onSuccess, }: Props)` | 78 |

## Interfaces

- **Backend endpoints called (via `/backend`):**
  - `GET /backend/org/resolve-pincode?${params.toString()}` (L155)
  - `GET /backend/auth/me` (L253)
- **Timers / queues:** `setTimeout` at L175, L225

## Dependencies

- **Internal:**
  - `components/ui/select.tsx` — `Select`, `SelectContent`, `SelectItem`, `SelectTrigger`, `SelectValue`
  - `components/ui/input.tsx` — `Input`
  - `components/ui/label.tsx` — `Label`
  - `lib/utils.ts` — `cn`
  - `lib/dialCodes.ts` — `phoneCountries as dialableCountries`
  - `lib/downlines-api.ts` — `checkDownlineEmail`, `enrollDownline`
  - `lib/api.ts` — `api`
- **Packages:**
  - `react` — `useEffect`, `useMemo`, `useRef`, `useState`
  - `lucide-react` — `AlertCircle`, `Building2`, `Check`, `Loader2`, `MapPin`, `Phone as PhoneIcon`, …
  - `sonner` — `toast`
  - `country-state-city` — `Country`

## Used by

- `components/dashboard/MainSidebar.tsx`
