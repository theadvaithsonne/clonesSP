# `app/garage-admin/(admin-dashboard)/networkchains/axons/[axonId]/page.tsx`

> Next.js page rendered at `/garage-admin/networkchains/axons/[axonId]`.

**Kind:** Next.js page · **Lines:** 602 · **Directive:** `"use client"` · **Route:** `/garage-admin/networkchains/axons/[axonId]` (page)

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Composition

**Renders:** `Section`×6 (local), `Shell`×2 (local), `Check` (lucide-react), `Copy` (lucide-react), `Icon` (local), `ArrowLeft` (lucide-react), `Loader2` (lucide-react), `StatusBadge` (local), `CopyId` (local), `GitMerge` (lucide-react), `GitPullRequestArrow` (lucide-react), `ChannelCard` (local), `MergeDialog` (components/nc-admin/axons/merge-dialog.tsx), `UnmergeDialog` (components/nc-admin/axons/unmerge-dialog.tsx)

### Props

- **`AdminAxonDetailPage`**: `params: Promise<{ axonId: string }>`

**Hooks used:** `useState`×7, `useRouter` (next/navigation), `useAdminAccess` (components/garage-admin/use-admin-access.ts), `useRef`, `useCallback`, `useEffect`

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `default (AdminAxonDetailPage)` | component | `AdminAxonDetailPage({ params, }: { params: Promise<{ axonId: string }>; })` | 187 |

## Interfaces

- **Timers / queues:** `setTimeout` at L41

## Dependencies

- **Internal:**
  - `lib/nc-admin-api/admin-axons.ts` — `getAxonDetail`, `axonLabel`, `RawAxon`, `AxonLink`, `AxonStatus`, `AxonEnrichmentChannel`
  - `lib/nc-admin-api/admin.ts` — `AdminUnauthorizedError`
  - `lib/nc-admin-api/auth.ts` — `ensureNcAdminToken`
  - `components/garage-admin/use-admin-access.ts` — `useAdminAccess`
  - `components/nc-admin/axons/merge-dialog.tsx` — `MergeDialog`
  - `components/nc-admin/axons/unmerge-dialog.tsx` — `UnmergeDialog`
- **Packages:**
  - `react` — `useEffect`, `useState`, `useCallback`, `useRef`, `use`
  - `next` — `useRouter`
  - `lucide-react` — `Loader2`, `ArrowLeft`, `GitMerge`, `GitPullRequestArrow`, `Mail`, `Phone`, …
  - `sonner` — `toast`

## Used by

Entry: reached by the Next.js router at `/garage-admin/networkchains/axons/[axonId]` (page).
