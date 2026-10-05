# `app/garage-admin/(admin-dashboard)/revenue-network/customers/page.tsx`

> Next.js page rendered at `/garage-admin/revenue-network/customers`.

**Kind:** Next.js page · **Lines:** 291 · **Directive:** `"use client"` · **Route:** `/garage-admin/revenue-network/customers` (page)

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Composition

**Renders:** `TableHead`×5 (components/ui/table.tsx), `TableCell`×5 (components/ui/table.tsx), `UsersRound`×3 (lucide-react), `TableRow`×2 (components/ui/table.tsx), `UserCheck` (lucide-react), `DollarSign` (lucide-react), `Card` (components/ui/card.tsx), `CardHeader` (components/ui/card.tsx), `CardTitle` (components/ui/card.tsx), `CardContent` (components/ui/card.tsx), `Table` (components/ui/table.tsx), `TableHeader` (components/ui/table.tsx), `TableBody` (components/ui/table.tsx), `Phone` (lucide-react), `Store` (lucide-react), `Building2` (lucide-react), `CheckCircle` (lucide-react), `XCircle` (lucide-react), `Link` (next/link), `Button` (components/ui/button.tsx), `ExternalLink` (lucide-react)

**Hooks used:** `useState`×2, `useEffect`

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `default (AllBuyersPage)` | component | `AllBuyersPage()` | 65 |

## Interfaces

- **Other fetch/api calls (target not statically resolvable):**
  - `GET ${GARAGE_ADMIN_API_URL}/api/public/customers` (L75)

## Dependencies

- **Internal:**
  - `components/ui/button.tsx` — `Button`
  - `components/ui/card.tsx` — `Card`, `CardContent`, `CardDescription`, `CardHeader`, `CardTitle`
  - `components/ui/table.tsx` — `Table`, `TableBody`, `TableCell`, `TableHead`, `TableHeader`, `TableRow`
  - `components/ui/badge.tsx` — `Badge`
  - `lib/api.ts` — `GARAGE_ADMIN_API_URL`
- **Packages:**
  - `react` — `useState`, `useEffect`
  - `lucide-react` — `UsersRound`, `DollarSign`, `Users`, `UserCheck`, `UserX`, `Calendar`, …
  - `sonner` — `toast`
  - `next`

## Used by

Entry: reached by the Next.js router at `/garage-admin/revenue-network/customers` (page).
