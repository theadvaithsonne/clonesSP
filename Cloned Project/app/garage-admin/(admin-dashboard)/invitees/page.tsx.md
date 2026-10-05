# `app/garage-admin/(admin-dashboard)/invitees/page.tsx`

> Next.js page rendered at `/garage-admin/invitees`.

**Kind:** Next.js page · **Lines:** 426 · **Directive:** `"use client"` · **Route:** `/garage-admin/invitees` (page)

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Composition

**Renders:** `TableHead`×15 (components/ui/table.tsx), `TableCell`×15 (components/ui/table.tsx), `Card`×8 (components/ui/card.tsx), `CardContent`×8 (components/ui/card.tsx), `CardHeader`×7 (components/ui/card.tsx), `CardTitle`×7 (components/ui/card.tsx), `TableRow`×6 (components/ui/table.tsx), `Badge`×5 (components/ui/badge.tsx), `CheckCircle`×3 (lucide-react), `XCircle`×3 (lucide-react), `CardDescription`×3 (components/ui/card.tsx), `Table`×3 (components/ui/table.tsx), `TableHeader`×3 (components/ui/table.tsx), `TableBody`×3 (components/ui/table.tsx), `InviteAdminDialog`×2 (components/garage-admin/InviteAdminDialog.tsx), `Users`×2 (lucide-react), `Clock`×2 (lucide-react), `Mail` (lucide-react), `Button` (components/ui/button.tsx), `UserPlus` (lucide-react)

**Hooks used:** `useState`×3, `useEffect`×2, `useAdminSearch` (components/garage-admin/admin-search.tsx)

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `default (GarageAdminInvitees)` | component | `GarageAdminInvitees()` | 58 |

## Interfaces

- **garage-admin API called (`my.revenue.network`):**
  - `` GET /garage-admin/admins${qs.toString() ? `?${qs.toString()}` : ""} `` (L79)
- **Browser storage / cookies:** `garage_admin_info` (localStorage: get)
- **Timers / queues:** `setTimeout` at L66

## Dependencies

- **Internal:**
  - `lib/api.ts` — `garageAdminApi`
  - `components/garage-admin/admin-search.tsx` — `useAdminSearch`
  - `components/ui/button.tsx` — `Button`
  - `components/ui/card.tsx` — `Card`, `CardContent`, `CardDescription`, `CardHeader`, `CardTitle`
  - `components/ui/table.tsx` — `Table`, `TableBody`, `TableCell`, `TableHead`, `TableHeader`, `TableRow`
  - `components/ui/badge.tsx` — `Badge`
  - `components/garage-admin/InviteAdminDialog.tsx` — `InviteAdminDialog (default)`
- **Packages:**
  - `react` — `useState`, `useEffect`
  - `lucide-react` — `Users`, `UserPlus`, `Mail`, `Clock`, `CheckCircle`, `XCircle`, …
  - `sonner` — `toast`

## Used by

Entry: reached by the Next.js router at `/garage-admin/invitees` (page).
