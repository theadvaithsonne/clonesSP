# `components/dashboard/FounderGuestsPage.tsx`

> Founder-facing tab under Office Settings → Guests.

**Kind:** React component · **Lines:** 355 · **Directive:** `"use client"`

<!-- docgen:auto -->

## Purpose
Founder-facing tab under Office Settings → Guests. Lists every user
who currently holds a guest:true membership on THIS org and lets the
founder graduate any of them to guest:false in one click.

This mirrors the super-admin /garage-admin/affiliate-guests page but
scoped to the founder's current org. Backend: /team/guests and
/team/guests/:userId/graduate (see routes/team.ts).

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Composition

**Renders:** `TableHead`×5 (components/ui/table.tsx), `TableCell`×5 (components/ui/table.tsx), `Card`×4 (components/ui/card.tsx), `CardHeader`×4 (components/ui/card.tsx), `CardTitle`×4 (components/ui/card.tsx), `CardContent`×4 (components/ui/card.tsx), `UserCheck`×3 (lucide-react), `Users`×2 (lucide-react), `Loader2`×2 (lucide-react), `TableRow`×2 (components/ui/table.tsx), `Badge`×2 (components/ui/badge.tsx), `CardDescription` (components/ui/card.tsx), `Search` (lucide-react), `Input` (components/ui/input.tsx), `Table` (components/ui/table.tsx), `TableHeader` (components/ui/table.tsx), `TableBody` (components/ui/table.tsx), `Mail` (lucide-react), `Phone` (lucide-react), `Calendar` (lucide-react), `Button` (components/ui/button.tsx), `CheckCircle` (lucide-react)

**Hooks used:** `useState`×4, `useMemo`×2, `useEffect`

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `default (FounderGuestsPage)` | component | `FounderGuestsPage()` | 61 |

## Interfaces

- **Backend endpoints called (via `/backend`):**
  - `GET /backend/team/guests?orgId=${encodeURIComponent(orgId)}` (L76)
  - `PATCH /backend/team/guests/${userId}/graduate?orgId=${encodeURIComponent(orgId || "")}` (L95)
- **Browser storage / cookies:** `garage_org_id` (localStorage: get)

## Dependencies

- **Internal:**
  - `lib/api.ts` — `api`
  - `components/ui/button.tsx` — `Button`
  - `components/ui/card.tsx` — `Card`, `CardContent`, `CardDescription`, `CardHeader`, `CardTitle`
  - `components/ui/table.tsx` — `Table`, `TableBody`, `TableCell`, `TableHead`, `TableHeader`, `TableRow`
  - `components/ui/badge.tsx` — `Badge`
  - `components/ui/input.tsx` — `Input`
- **Packages:**
  - `react` — `useEffect`, `useMemo`, `useState`
  - `sonner` — `toast`
  - `lucide-react` — `Users`, `UserCheck`, `Mail`, `Phone`, `Loader2`, `CheckCircle`, …

## Used by

- `components/dashboard/ManagementPage.tsx`
