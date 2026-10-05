# `app/garage-admin/(admin-dashboard)/networkchains/funnels/[id]/page.tsx`

> Next.js page rendered at `/garage-admin/networkchains/funnels/[id]`.

**Kind:** Next.js page · **Lines:** 253 · **Directive:** `"use client"` · **Route:** `/garage-admin/networkchains/funnels/[id]` (page)

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Composition

**Renders:** `Button`×5 (components/ui/button.tsx), `Loader2`×2 (lucide-react), `Link`×2 (next/link), `Badge`×2 (components/ui/badge.tsx), `Star`×2 (lucide-react), `ArrowLeft` (lucide-react), `Input` (components/ui/input.tsx), `FunnelCtaPicker` (components/funnel-studio/funnel-cta-picker.tsx), `Save` (lucide-react), `Trash2` (lucide-react), `FunnelStudio` (components/funnel-studio/funnel-studio.tsx), `ConfirmDialog` (components/ui/confirm-dialog.tsx)

### Props

- **`FunnelEditorPage`**: `params: Promise<{ id: string }>`

**Hooks used:** `useState`×6, `useRouter` (next/navigation), `useAdminFunnel` (lib/hooks/use-admin-funnels.ts), `useSaveFunnel` (lib/hooks/use-admin-funnels.ts), `useUpdateFunnelMeta` (lib/hooks/use-admin-funnels.ts), `useAdminAccess` (components/garage-admin/use-admin-access.ts), `useSetDefaultFunnel` (lib/hooks/use-admin-funnels.ts), `useDeleteFunnel` (lib/hooks/use-admin-funnels.ts), `useRef`, `useEffect`

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `default (FunnelEditorPage)` | component | `FunnelEditorPage({ params, }: { params: Promise<{ id: string }>; })` | 40 |

## Interfaces

None detected: no endpoints, events, data access or environment reads were found.

## Dependencies

- **Internal:**
  - `components/ui/button.tsx` — `Button`
  - `components/ui/input.tsx` — `Input`
  - `components/ui/badge.tsx` — `Badge`
  - `components/ui/confirm-dialog.tsx` — `ConfirmDialog`
  - `components/funnel-studio/funnel-studio.tsx` — `FunnelStudio`, `FunnelStudioHandle`
  - `components/funnel-studio/funnel-cta-picker.tsx` — `FunnelCtaPicker`
  - `lib/affiliate/library-affiliate.ts` — `fetchLibraryAffiliate`
  - `lib/nc-admin-api/admin-funnels.ts` — `adminFunnelsApi`, `FunnelCta`
  - `lib/hooks/use-admin-funnels.ts` — `useAdminFunnel`, `useSaveFunnel`, `useUpdateFunnelMeta`, `useSetDefaultFunnel`, `useDeleteFunnel`
  - `components/garage-admin/use-admin-access.ts` — `useAdminAccess`
  - `lib/api/funnels.ts` — `FunnelLink`, `(types only)`
- **Packages:**
  - `react` — `use`, `useEffect`, `useRef`, `useState`
  - `next` — `useRouter`
  - `lucide-react` — `ArrowLeft`, `Loader2`, `Save`, `Star`, `Trash2`

## Used by

Entry: reached by the Next.js router at `/garage-admin/networkchains/funnels/[id]` (page).
