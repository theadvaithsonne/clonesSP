# `app/garage-admin/(admin-dashboard)/revenue-network/admins/[id]/page.tsx`

> Next.js page rendered at `/garage-admin/revenue-network/admins/[id]`.

**Kind:** Next.js page · **Lines:** 435 · **Directive:** `"use client"` · **Route:** `/garage-admin/revenue-network/admins/[id]` (page)

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Composition

**Renders:** `Button`×5 (components/ui/button.tsx), `XCircle`×3 (lucide-react), `Copy`×3 (lucide-react), `User`×3 (lucide-react), `ArrowLeft`×2 (lucide-react), `Card`×2 (components/ui/card.tsx), `CardHeader`×2 (components/ui/card.tsx), `CardTitle`×2 (components/ui/card.tsx), `Badge`×2 (components/ui/badge.tsx), `CheckCircle`×2 (lucide-react), `CardContent`×2 (components/ui/card.tsx), `DollarSign`×2 (lucide-react), `Network`×2 (lucide-react), `Calendar`×2 (lucide-react), `CardDescription` (components/ui/card.tsx), `Mail` (lucide-react), `Building2` (lucide-react), `ExternalLink` (lucide-react)

**Hooks used:** `useState`×2, `useParams` (next/navigation), `useRouter` (next/navigation), `useEffect`

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `default (RevenueNetworkAdminDetailPage)` | component | `RevenueNetworkAdminDetailPage()` | 40 |

## Interfaces

- **Other fetch/api calls (target not statically resolvable):**
  - `GET ${GARAGE_ADMIN_API_URL}/api/public/admins` (L54)

## Dependencies

- **Internal:**
  - `components/ui/button.tsx` — `Button`
  - `components/ui/card.tsx` — `Card`, `CardContent`, `CardDescription`, `CardHeader`, `CardTitle`
  - `components/ui/badge.tsx` — `Badge`
  - `lib/api.ts` — `GARAGE_ADMIN_API_URL`
- **Packages:**
  - `react` — `useState`, `useEffect`
  - `next` — `useParams`, `useRouter`
  - `lucide-react` — `Network`, `ArrowLeft`, `User`, `Mail`, `Calendar`, `CheckCircle`, …
  - `sonner` — `toast`

## Used by

Entry: reached by the Next.js router at `/garage-admin/revenue-network/admins/[id]` (page).
