# `app/garage-admin/(admin-dashboard)/cryptobrand-offices/page.tsx`

> Sidebar page: /garage-admin/cryptobrand-offices

**Kind:** Next.js page · **Lines:** 270 · **Directive:** `"use client"` · **Route:** `/garage-admin/cryptobrand-offices` (page)

<!-- docgen:auto -->

## Purpose
Sidebar page: /garage-admin/cryptobrand-offices

Lists every org where Organization.officeCreatedFromCryptobrand === true.
Clicking a row drills into the org's member list at
/garage-admin/cryptobrand-offices/[orgId].

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Composition

**Renders:** `TableHead`×5 (components/ui/table.tsx), `TableCell`×5 (components/ui/table.tsx), `Card`×3 (components/ui/card.tsx), `CardHeader`×3 (components/ui/card.tsx), `CardTitle`×3 (components/ui/card.tsx), `Bitcoin`×3 (lucide-react), `CardContent`×3 (components/ui/card.tsx), `Users`×2 (lucide-react), `TableRow`×2 (components/ui/table.tsx), `CardDescription` (components/ui/card.tsx), `Search` (lucide-react), `Input` (components/ui/input.tsx), `Loader2` (lucide-react), `Table` (components/ui/table.tsx), `TableHeader` (components/ui/table.tsx), `TableBody` (components/ui/table.tsx), `Building2` (lucide-react), `MapPin` (lucide-react), `Badge` (components/ui/badge.tsx), `Calendar` (lucide-react), `Link` (next/link), `ChevronRight` (lucide-react)

**Hooks used:** `useState`×4, `useEffect`×2, `useMemo`

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `default (CryptobrandOfficesPage)` | component | `CryptobrandOfficesPage()` | 57 |

## Interfaces

- **garage-admin API called (`my.revenue.network`):**
  - `` GET /garage-admin/cryptobrand-offices${qs.toString() ? `?${qs.toString()}` : ""} `` (L74)
- **Timers / queues:** `setTimeout` at L64

## Dependencies

- **Internal:**
  - `lib/api.ts` — `garageAdminApi`
  - `components/ui/card.tsx` — `Card`, `CardContent`, `CardDescription`, `CardHeader`, `CardTitle`
  - `components/ui/table.tsx` — `Table`, `TableBody`, `TableCell`, `TableHead`, `TableHeader`, `TableRow`
  - `components/ui/badge.tsx` — `Badge`
  - `components/ui/input.tsx` — `Input`
- **Packages:**
  - `react` — `useEffect`, `useMemo`, `useState`
  - `next`
  - `sonner` — `toast`
  - `lucide-react` — `Building2`, `Users`, `Bitcoin`, `Loader2`, `Search`, `MapPin`, …

## Used by

Entry: reached by the Next.js router at `/garage-admin/cryptobrand-offices` (page).
