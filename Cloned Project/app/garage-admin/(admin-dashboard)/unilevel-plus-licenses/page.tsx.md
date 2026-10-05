# `app/garage-admin/(admin-dashboard)/unilevel-plus-licenses/page.tsx`

> Next.js page rendered at `/garage-admin/unilevel-plus-licenses`.

**Kind:** Next.js page · **Lines:** 1049 · **Directive:** `"use client"` · **Route:** `/garage-admin/unilevel-plus-licenses` (page)

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Composition

**Renders:** `StatPill`×6 (local), `FilterField`×5 (local), `StatCard`×4 (local), `Copy`×4 (lucide-react), `Ticket`×3 (lucide-react), `Input`×3 (components/ui/input.tsx), `Crown`×2 (lucide-react), `Archive`×2 (lucide-react), `Card`×2 (components/ui/card.tsx), `CardHeader`×2 (components/ui/card.tsx), `CardTitle`×2 (components/ui/card.tsx), `Search`×2 (lucide-react), `CardContent`×2 (components/ui/card.tsx), `Trophy`×2 (lucide-react), `DollarSign` (lucide-react), `CardDescription` (components/ui/card.tsx), `SlidersHorizontal` (lucide-react), `X` (lucide-react), `EmptyState` (local), `Accordion` (components/ui/accordion.tsx), `HolderRow` (local), `Select` (components/ui/select.tsx), `SelectTrigger` (components/ui/select.tsx), `SelectValue` (components/ui/select.tsx), `SelectContent` (components/ui/select.tsx), `SelectItem` (components/ui/select.tsx), `AccordionItem` (components/ui/accordion.tsx), `AccordionTrigger` (components/ui/accordion.tsx), `Avatar` (components/ui/avatar.tsx), `AvatarImage` (components/ui/avatar.tsx), `AvatarFallback` (components/ui/avatar.tsx), `AccordionContent` (components/ui/accordion.tsx), `Users` (lucide-react), `UserCheck` (lucide-react), `UserX` (lucide-react), `Send` (lucide-react), `OfficeRow` (local), `Receipt` (lucide-react), `PaymentRow` (local), `ExternalLink` (lucide-react), … +2 more

**Hooks used:** `useState`×6, `useMemo`×5, `useEffect`×3, `useCallback`×2, `useRef`, `useAdminSearch` (components/garage-admin/admin-search.tsx)

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `default (UnilevelPlusLicensesPage)` | component | `UnilevelPlusLicensesPage()` | 192 |

## Interfaces

- **garage-admin API called (`my.revenue.network`):**
  - `GET /garage-admin/unilevel-plus-license-holders` (L226)
- **Timers / queues:** `setTimeout` at L207

## Dependencies

- **Internal:**
  - `lib/admin-domain.ts` — `invoiceUrl`
  - `lib/api.ts` — `garageAdminApi`
  - `components/garage-admin/admin-search.tsx` — `useAdminSearch`
  - `components/ui/card.tsx` — `Card`, `CardContent`, `CardDescription`, `CardHeader`, `CardTitle`
  - `components/ui/accordion.tsx` — `Accordion`, `AccordionContent`, `AccordionItem`, `AccordionTrigger`
  - `components/ui/input.tsx` — `Input`
  - `components/ui/avatar.tsx` — `Avatar`, `AvatarFallback`, `AvatarImage`
  - `components/ui/select.tsx` — `Select`, `SelectContent`, `SelectItem`, `SelectTrigger`, `SelectValue`
- **Packages:**
  - `react` — `useEffect`, `useMemo`, `useState`, `useCallback`, `useRef`
  - `lucide-react` — `Crown`, `Ticket`, `Archive`, `DollarSign`, `Building2`, `Search`, …
  - `sonner` — `toast`

## Used by

Entry: reached by the Next.js router at `/garage-admin/unilevel-plus-licenses` (page).
