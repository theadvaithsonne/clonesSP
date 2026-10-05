# `app/garage-admin/(admin-dashboard)/cryptobrand-offices/[orgId]/page.tsx`

> Drill-in page: /garage-admin/cryptobrand-offices/[orgId]

**Kind:** Next.js page · **Lines:** 331 · **Directive:** `"use client"` · **Route:** `/garage-admin/cryptobrand-offices/[orgId]` (page)

<!-- docgen:auto -->

## Purpose
Drill-in page: /garage-admin/cryptobrand-offices/[orgId]

Lists every member of the selected cryptobrand office. Clicking a
row drills into the user's wallets at
/garage-admin/cryptobrand-offices/[orgId]/users/[userId].

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Composition

**Renders:** `Users`×5 (lucide-react), `TableHead`×5 (components/ui/table.tsx), `TableCell`×5 (components/ui/table.tsx), `Card`×4 (components/ui/card.tsx), `CardHeader`×4 (components/ui/card.tsx), `CardTitle`×4 (components/ui/card.tsx), `CardContent`×4 (components/ui/card.tsx), `Badge`×3 (components/ui/badge.tsx), `Link`×2 (next/link), `TableRow`×2 (components/ui/table.tsx), `ArrowLeft` (lucide-react), `Bitcoin` (lucide-react), `CardDescription` (components/ui/card.tsx), `Search` (lucide-react), `Input` (components/ui/input.tsx), `Loader2` (lucide-react), `Table` (components/ui/table.tsx), `TableHeader` (components/ui/table.tsx), `TableBody` (components/ui/table.tsx), `Mail` (lucide-react), `Phone` (lucide-react), `Wallet` (lucide-react), `ChevronRight` (lucide-react)

**Hooks used:** `useState`×5, `useEffect`×2, `useParams` (next/navigation), `useMemo`

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `default (CryptobrandOfficeMembersPage)` | component | `CryptobrandOfficeMembersPage()` | 61 |

## Interfaces

- **garage-admin API called (`my.revenue.network`):**
  - `` GET /garage-admin/cryptobrand-offices/${orgId}/members${qs.toString() ? `?${qs.toString()}` : ""} `` (L82)
- **Timers / queues:** `setTimeout` at L71

## Dependencies

- **Internal:**
  - `lib/api.ts` — `garageAdminApi`
  - `components/ui/card.tsx` — `Card`, `CardContent`, `CardDescription`, `CardHeader`, `CardTitle`
  - `components/ui/table.tsx` — `Table`, `TableBody`, `TableCell`, `TableHead`, `TableHeader`, `TableRow`
  - `components/ui/badge.tsx` — `Badge`
  - `components/ui/input.tsx` — `Input`
- **Packages:**
  - `react` — `useEffect`, `useMemo`, `useState`
  - `next` — `useParams`
  - `sonner` — `toast`
  - `lucide-react` — `Users`, `ArrowLeft`, `Bitcoin`, `Loader2`, `Search`, `Mail`, …

## Used by

Entry: reached by the Next.js router at `/garage-admin/cryptobrand-offices/[orgId]` (page).
