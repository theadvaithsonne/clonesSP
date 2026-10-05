# `app/garage-admin/(admin-dashboard)/organizations/page.tsx`

> Next.js page rendered at `/garage-admin/organizations`.

**Kind:** Next.js page · **Lines:** 493 · **Directive:** `"use client"` · **Route:** `/garage-admin/organizations` (page)

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Composition

**Renders:** `TableHead`×9 (components/ui/table.tsx), `TableCell`×9 (components/ui/table.tsx), `Card`×5 (components/ui/card.tsx), `CardHeader`×5 (components/ui/card.tsx), `CardTitle`×5 (components/ui/card.tsx), `Building2`×5 (lucide-react), `CardContent`×5 (components/ui/card.tsx), `Globe`×2 (lucide-react), `TableRow`×2 (components/ui/table.tsx), `Badge`×2 (components/ui/badge.tsx), `Image`×2 (lucide-react), `Button`×2 (components/ui/button.tsx), `Users` (lucide-react), `CardDescription` (components/ui/card.tsx), `Table` (components/ui/table.tsx), `TableHeader` (components/ui/table.tsx), `TableBody` (components/ui/table.tsx), `Video` (lucide-react), `Eye` (lucide-react), `Trash2` (lucide-react), `DangerConfirmDialog` (components/garage-admin/DangerConfirmDialog.tsx)

**Hooks used:** `useState`×8, `useEffect`×2, `useRouter` (next/navigation), `useAdminAccess` (components/garage-admin/use-admin-access.ts), `useAdminSearch` (components/garage-admin/admin-search.tsx)

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `default (OrganizationsPage)` | component | `OrganizationsPage()` | 87 |

## Interfaces

- **garage-admin API called (`my.revenue.network`):**
  - `` GET /garage-admin/organizations${qs.toString() ? `?${qs.toString()}` : ""} `` (L113)
- **Timers / queues:** `setTimeout` at L100

## Dependencies

- **Internal:**
  - `lib/api.ts` — `garageAdminApi`
  - `components/garage-admin/admin-search.tsx` — `useAdminSearch`
  - `components/ui/button.tsx` — `Button`
  - `components/ui/card.tsx` — `Card`, `CardContent`, `CardDescription`, `CardHeader`, `CardTitle`
  - `components/ui/table.tsx` — `Table`, `TableBody`, `TableCell`, `TableHead`, `TableHeader`, `TableRow`
  - `components/ui/badge.tsx` — `Badge`
  - `lib/admin-api/danger-zone.ts` — `getOrgDeletePreview`, `deleteAdminOrganization`, `OrgDeletePreview`
  - `components/garage-admin/DangerConfirmDialog.tsx` — `DangerConfirmDialog (default)`
  - `components/garage-admin/use-admin-access.ts` — `useAdminAccess`
  - `lib/org-kyc.ts` — `ORG_KYC_STATUS_LABEL`, `OrgKycStatus`
- **Packages:**
  - `react` — `useState`, `useEffect`
  - `next` — `useRouter`
  - `lucide-react` — `Building2`, `MapPin`, `Users`, `Calendar`, `ExternalLink`, `Eye`, …
  - `sonner` — `toast`

## Used by

Entry: reached by the Next.js router at `/garage-admin/organizations` (page).
