# `app/garage-admin/(admin-dashboard)/networkchains/funnels/page.tsx`

> Next.js page rendered at `/garage-admin/networkchains/funnels`.

**Kind:** Next.js page · **Lines:** 188 · **Directive:** `"use client"` · **Route:** `/garage-admin/networkchains/funnels` (page)

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Composition

**Renders:** `Button`×4 (components/ui/button.tsx), `Star`×2 (lucide-react), `Workflow` (lucide-react), `Loader2` (lucide-react), `Plus` (lucide-react), `Skeleton` (components/ui/skeleton.tsx), `Badge` (components/ui/badge.tsx), `Tag` (lucide-react), `Link` (next/link), `Pencil` (lucide-react), `Eye` (lucide-react), `Trash2` (lucide-react), `ConfirmDialog` (components/ui/confirm-dialog.tsx)

**Hooks used:** `useRouter` (next/navigation), `useAdminFunnels` (lib/hooks/use-admin-funnels.ts), `useCreateFunnel` (lib/hooks/use-admin-funnels.ts), `useSetDefaultFunnel` (lib/hooks/use-admin-funnels.ts), `useDeleteFunnel` (lib/hooks/use-admin-funnels.ts), `useAdminAccess` (components/garage-admin/use-admin-access.ts), `useState`

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `default (FunnelsListPage)` | component | `FunnelsListPage()` | 30 |

## Interfaces

None detected: no endpoints, events, data access or environment reads were found.

## Dependencies

- **Internal:**
  - `components/ui/button.tsx` — `Button`
  - `components/ui/badge.tsx` — `Badge`
  - `components/ui/skeleton.tsx` — `Skeleton`
  - `components/ui/confirm-dialog.tsx` — `ConfirmDialog`
  - `lib/hooks/use-admin-funnels.ts` — `useAdminFunnels`, `useCreateFunnel`, `useSetDefaultFunnel`, `useDeleteFunnel`
  - `lib/utils/format.ts` — `formatRelativeTime`
  - `lib/nc-admin-api/admin-funnels.ts` — `FunnelListItem`, `(types only)`
  - `components/garage-admin/use-admin-access.ts` — `useAdminAccess`
- **Packages:**
  - `react` — `useState`
  - `next` — `useRouter`
  - `lucide-react` — `Loader2`, `Workflow`, `Plus`, `Eye`, `Star`, `Tag`, …

## Used by

Entry: reached by the Next.js router at `/garage-admin/networkchains/funnels` (page).
