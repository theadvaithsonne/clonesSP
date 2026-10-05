# `app/garage-admin/(admin-dashboard)/stakeholders/page.tsx`

> Next.js page rendered at `/garage-admin/stakeholders`.

**Kind:** Next.js page · **Lines:** 341 · **Directive:** `"use client"` · **Route:** `/garage-admin/stakeholders` (page)

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Composition

**Renders:** `TableHead`×6 (components/ui/table.tsx), `TableCell`×6 (components/ui/table.tsx), `Card`×5 (components/ui/card.tsx), `CardHeader`×5 (components/ui/card.tsx), `CardTitle`×5 (components/ui/card.tsx), `CardContent`×5 (components/ui/card.tsx), `Users`×3 (lucide-react), `UserCheck`×2 (lucide-react), `CheckCircle`×2 (lucide-react), `TableRow`×2 (components/ui/table.tsx), `Building2`×2 (lucide-react), `Globe` (lucide-react), `CardDescription` (components/ui/card.tsx), `Table` (components/ui/table.tsx), `TableHeader` (components/ui/table.tsx), `TableBody` (components/ui/table.tsx), `Phone` (lucide-react), `MapPin` (lucide-react), `UserX` (lucide-react), `XCircle` (lucide-react)

**Hooks used:** `useState`×3, `useEffect`×2, `useAdminSearch` (components/garage-admin/admin-search.tsx)

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `default (StakeholdersPage)` | component | `StakeholdersPage()` | 72 |

## Interfaces

- **garage-admin API called (`my.revenue.network`):**
  - `` GET /garage-admin/stakeholders${qs.toString() ? `?${qs.toString()}` : ""} `` (L93)
- **Timers / queues:** `setTimeout` at L80

## Dependencies

- **Internal:**
  - `lib/api.ts` — `garageAdminApi`
  - `components/garage-admin/admin-search.tsx` — `useAdminSearch`
  - `components/ui/button.tsx` — `Button`
  - `components/ui/card.tsx` — `Card`, `CardContent`, `CardDescription`, `CardHeader`, `CardTitle`
  - `components/ui/table.tsx` — `Table`, `TableBody`, `TableCell`, `TableHead`, `TableHeader`, `TableRow`
  - `components/ui/badge.tsx` — `Badge`
- **Packages:**
  - `react` — `useState`, `useEffect`
  - `lucide-react` — `Users`, `MapPin`, `Phone`, `Mail`, `Calendar`, `UserCheck`, …
  - `sonner` — `toast`

## Used by

Entry: reached by the Next.js router at `/garage-admin/stakeholders` (page).
