# `app/garage-admin/(admin-dashboard)/revenue-network/stores/[id]/page.tsx`

> Next.js page rendered at `/garage-admin/revenue-network/stores/[id]`.

**Kind:** Next.js page · **Lines:** 613 · **Directive:** `"use client"` · **Route:** `/garage-admin/revenue-network/stores/[id]` (page)

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Composition

**Renders:** `Button`×4 (components/ui/button.tsx), `Card`×4 (components/ui/card.tsx), `CardHeader`×4 (components/ui/card.tsx), `CardTitle`×4 (components/ui/card.tsx), `CardContent`×4 (components/ui/card.tsx), `Badge`×3 (components/ui/badge.tsx), `Store`×2 (lucide-react), `ArrowLeft`×2 (lucide-react), `Globe`×2 (lucide-react), `Users`×2 (lucide-react), `Package`×2 (lucide-react), `GraduationCap`×2 (lucide-react), `CardDescription` (components/ui/card.tsx), `Copy` (lucide-react), `Tag` (lucide-react), `Calendar` (lucide-react), `DollarSign` (lucide-react)

**Hooks used:** `useState`×5, `useParams` (next/navigation), `useRouter` (next/navigation), `useEffect`

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `default (StoreDetailPage)` | component | `StoreDetailPage()` | 113 |

## Interfaces

- **Other fetch/api calls (target not statically resolvable):**
  - `GET ${GARAGE_ADMIN_API_URL}/api/public/stores` (L131)
  - `GET ${GARAGE_ADMIN_API_URL}/api/public/stores/${storeId}/customers` (L161)
  - `GET ${GARAGE_ADMIN_API_URL}/api/public/stores/${storeId}/products` (L179)
  - `GET ${GARAGE_ADMIN_API_URL}/api/public/stores/${storeId}/courses` (L197)

## Dependencies

- **Internal:**
  - `components/ui/button.tsx` — `Button`
  - `components/ui/card.tsx` — `Card`, `CardContent`, `CardDescription`, `CardHeader`, `CardTitle`
  - `components/ui/badge.tsx` — `Badge`
  - `lib/api.ts` — `GARAGE_ADMIN_API_URL`
- **Packages:**
  - `react` — `useState`, `useEffect`
  - `next` — `useParams`, `useRouter`
  - `lucide-react` — `Store`, `ArrowLeft`, `Globe`, `Calendar`, `ExternalLink`, `Copy`, …
  - `sonner` — `toast`

## Used by

Entry: reached by the Next.js router at `/garage-admin/revenue-network/stores/[id]` (page).
