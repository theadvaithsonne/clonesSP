# `app/garage-admin/(admin-dashboard)/organizations/[id]/page.tsx`

> Next.js page rendered at `/garage-admin/organizations/[id]`.

**Kind:** Next.js page · **Lines:** 1386 · **Directive:** `"use client"` · **Route:** `/garage-admin/organizations/[id]` (page)

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Composition

**Renders:** `Button`×16 (components/ui/button.tsx), `CheckCircle`×11 (lucide-react), `Copy`×11 (lucide-react), `Card`×8 (components/ui/card.tsx), `CardHeader`×8 (components/ui/card.tsx), `CardTitle`×8 (components/ui/card.tsx), `CardContent`×8 (components/ui/card.tsx), `Badge`×6 (components/ui/badge.tsx), `CardDescription`×5 (components/ui/card.tsx), `Loader2`×3 (lucide-react), `Building2`×2 (lucide-react), `ArrowLeft`×2 (lucide-react), `Image`×2 (lucide-react), `ExternalLink`×2 (lucide-react), `Globe`×2 (lucide-react), `ShoppingBag`×2 (lucide-react), `MapPin` (lucide-react), `Video` (lucide-react), `Store` (lucide-react), `Hash` (lucide-react), `Layers` (lucide-react), `Users` (lucide-react), `UserCheck` (lucide-react), `UserX` (lucide-react), `SellableItemsCard` (local), `FileText` (lucide-react), `Receipt` (lucide-react), `Repeat` (lucide-react), `Calendar` (lucide-react), `Icon` (local)

**Hooks used:** `useState`×13, `useRouter` (next/navigation), `useParams` (next/navigation), `useEffect`

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `default (OrganizationDetailPage)` | component | `OrganizationDetailPage()` | 163 |

## Interfaces

- **garage-admin API called (`my.revenue.network`):**
  - `GET /garage-admin/organizations/${orgId}` (L198)
  - `GET /garage-admin/organizations/${orgId}/invoices?limit=${INVOICES_PAGE_SIZE}&offset=${offset}` (L218)
  - `GET /garage-admin/organizations/${orgId}/sellable-items` (L240)
- **Timers / queues:** `setTimeout` at L265

## Dependencies

- **Internal:**
  - `lib/admin-domain.ts` — `invoiceUrl`
  - `lib/api.ts` — `garageAdminApi`
  - `components/ui/button.tsx` — `Button`
  - `components/ui/card.tsx` — `Card`, `CardContent`, `CardDescription`, `CardHeader`, `CardTitle`
  - `components/ui/badge.tsx` — `Badge`
- **Packages:**
  - `react` — `useState`, `useEffect`
  - `next` — `useRouter`, `useParams`
  - `lucide-react` — `Building2`, `MapPin`, `Calendar`, `ArrowLeft`, `Globe`, `Video`, …
  - `sonner` — `toast`

## Used by

Entry: reached by the Next.js router at `/garage-admin/organizations/[id]` (page).
