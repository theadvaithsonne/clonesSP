# `app/garage-admin/(admin-dashboard)/networkchains/ai-cost/page.tsx`

> Next.js page rendered at `/garage-admin/networkchains/ai-cost`.

**Kind:** Next.js page · **Lines:** 384 · **Directive:** `"use client"` · **Route:** `/garage-admin/networkchains/ai-cost` (page)

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Composition

**Renders:** `Loader2`×3 (lucide-react), `DollarSign` (lucide-react), `ChevronRight` (lucide-react), `DrillDown` (local), `X` (lucide-react)

**Hooks used:** `useState`×2, `useUsageSummary` (lib/hooks/use-admin-usage.ts), `useUsageUsers` (lib/hooks/use-admin-usage.ts), `useRef`, `useEffect`, `useMemo`, `useUsageUser` (lib/hooks/use-admin-usage.ts)

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `default (AiCostPage)` | component | `AiCostPage()` | 38 |

## Interfaces

None detected: no endpoints, events, data access or environment reads were found.

## Dependencies

- **Internal:**
  - `lib/nc-admin-api/admin.ts` — `AdminUnauthorizedError`, `ADMIN_PRODUCTS`, `PRODUCT_LABELS`, `formatCents`, `AdminProduct`
  - `lib/nc-admin-api/auth.ts` — `ensureNcAdminToken`
  - `lib/hooks/use-admin-usage.ts` — `useUsageSummary`, `useUsageUser`, `useUsageUsers`
- **Packages:**
  - `react` — `useEffect`, `useMemo`, `useRef`, `useState`
  - `lucide-react` — `Loader2`, `X`, `DollarSign`, `ChevronRight`

## Used by

Entry: reached by the Next.js router at `/garage-admin/networkchains/ai-cost` (page).
