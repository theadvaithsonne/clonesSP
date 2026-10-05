# `app/garage-admin/(admin-dashboard)/revenue-network/admins/page.tsx`

> Next.js page rendered at `/garage-admin/revenue-network/admins`.

**Kind:** Next.js page · **Lines:** 249 · **Directive:** `"use client"` · **Route:** `/garage-admin/revenue-network/admins` (page)

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Composition

**Renders:** `TableHead`×5 (components/ui/table.tsx), `TableCell`×5 (components/ui/table.tsx), `Network`×2 (lucide-react), `TableRow`×2 (components/ui/table.tsx), `UserCheck` (lucide-react), `DollarSign` (lucide-react), `Card` (components/ui/card.tsx), `CardHeader` (components/ui/card.tsx), `CardTitle` (components/ui/card.tsx), `Users` (lucide-react), `CardContent` (components/ui/card.tsx), `Table` (components/ui/table.tsx), `TableHeader` (components/ui/table.tsx), `TableBody` (components/ui/table.tsx), `Badge` (components/ui/badge.tsx), `CheckCircle` (lucide-react), `XCircle` (lucide-react), `Link` (next/link), `Button` (components/ui/button.tsx), `ExternalLink` (lucide-react)

**Hooks used:** `useState`×2, `useEffect`

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `default (RevenueNetworkPage)` | component | `RevenueNetworkPage()` | 50 |

## Interfaces

- **Other fetch/api calls (target not statically resolvable):**
  - `GET ${GARAGE_ADMIN_API_URL}/api/public/admins` (L60)

## Dependencies

- **Internal:**
  - `components/ui/button.tsx` — `Button`
  - `components/ui/card.tsx` — `Card`, `CardContent`, `CardDescription`, `CardHeader`, `CardTitle`
  - `components/ui/table.tsx` — `Table`, `TableBody`, `TableCell`, `TableHead`, `TableHeader`, `TableRow`
  - `components/ui/badge.tsx` — `Badge`
  - `lib/api.ts` — `GARAGE_ADMIN_API_URL`
- **Packages:**
  - `react` — `useState`, `useEffect`
  - `lucide-react` — `Network`, `DollarSign`, `Users`, `UserCheck`, `UserX`, `Calendar`, …
  - `sonner` — `toast`
  - `next`

## Used by

Entry: reached by the Next.js router at `/garage-admin/revenue-network/admins` (page).
