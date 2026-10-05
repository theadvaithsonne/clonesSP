# `components/dashboard/DropsPage.tsx`

> React component `DropsPage`.

**Kind:** React component · **Lines:** 618 · **Directive:** `"use client"`

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Composition

**Renders:** `Loader2`×3 (lucide-react), `Plus`×2 (lucide-react), `Eye`×2 (lucide-react), `Heart`×2 (lucide-react), `MyUploadsTab` (components/dashboard/drops/MyUploadsTab.tsx), `AllDropsTab` (components/dashboard/drops/AllDropsTab.tsx), `Video` (lucide-react), `Clock` (lucide-react), `Play` (lucide-react), `ArrowLeft` (lucide-react), `DropVideoPlayer` (components/dashboard/drops/DropVideoPlayer.tsx), `Share2` (lucide-react), `ChevronUp` (lucide-react), `ChevronDown` (lucide-react), `DropUploadModal` (components/dashboard/drops/DropUploadModal.tsx), `Check` (lucide-react), `Copy` (lucide-react)

### Props

- **`DropsPage`**: `initialTab?: "feed" | "uploads" | "all"`, `viewRole?: "founder" | "customer"`

**Hooks used:** `useState`×16, `useCallback`×8, `useEffect`×7, `useRef`, `useAmIFounder` (lib/hooks/useAmIFounder.ts), `useMemo`

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `DropsPage` | component | `DropsPage({ initialTab = "feed", viewRole = "customer" }: DropsPagePr…)` | 39 |

## Interfaces

- **Backend endpoints called (via `/backend`):**
  - `GET /backend/affiliate/my-affiliate-id` (L100)
  - `GET /backend/org/${orgId}` (L109)
  - `GET /backend/drops/${targetDropId}` (L131)
  - `POST /backend/drops/${id}/view` (L233)
  - `POST /backend/drops/${id}/like` (L240)
  - `POST /backend/drops/${id}/share` (L256)
- **Browser storage / cookies:** `garage_org_id` (localStorage: get), `target_drop_id` (localStorage: get/remove)
- **Timers / queues:** `setTimeout` at L89, L263

## Dependencies

- **Internal:**
  - `lib/utils.ts` — `cn`
  - `lib/api.ts` — `api`, `API_URL`
  - `lib/auth.ts` — `getToken`, `getUserIdFromToken`
  - `components/dashboard/drops/DropVideoPlayer.tsx` — `DropVideoPlayer (default)`
  - `components/dashboard/drops/DropUploadModal.tsx` — `DropUploadModal (default)`
  - `components/dashboard/drops/MyUploadsTab.tsx` — `MyUploadsTab (default)`
  - `components/dashboard/drops/AllDropsTab.tsx` — `AllDropsTab (default)`
  - `lib/hooks/useAmIFounder.ts` — `useAmIFounder`
  - `lib/revenue-network-cache.ts` — `getRevenueNetworkCache`
- **Packages:**
  - `react` — `useState`, `useEffect`, `useCallback`, `useRef`, `useMemo`
  - `lucide-react` — `Plus`, `Heart`, `Share2`, `Eye`, `Copy`, `Check`, …

## Used by

- `components/dashboard/RevenueNetworkPages.tsx`
