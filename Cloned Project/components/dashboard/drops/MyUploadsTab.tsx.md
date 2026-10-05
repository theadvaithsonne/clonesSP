# `components/dashboard/drops/MyUploadsTab.tsx`

> React component `MyUploadsTab`.

**Kind:** React component · **Lines:** 238 · **Directive:** `"use client"`

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Composition

**Renders:** `X`×2 (lucide-react), `Loader2` (lucide-react), `Plus` (lucide-react), `Play` (lucide-react), `Clock` (lucide-react), `Save` (lucide-react), `Eye` (lucide-react), `Heart` (lucide-react), `Share2` (lucide-react), `Pencil` (lucide-react), `Trash2` (lucide-react), `DropVideoPlayer` (components/dashboard/drops/DropVideoPlayer.tsx), `DeleteConfirmModal` (components/dashboard/drops/DeleteConfirmModal.tsx)

### Props

- **`MyUploadsTab`**: `orgId: string`, `onDeleted: (id: string) => void`, `onUpload?: () => void`

**Hooks used:** `useState`×7, `useCallback`, `useEffect`

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `default (MyUploadsTab)` | component | `MyUploadsTab({ orgId, onDeleted, onUpload }: MyUploadsTabProps)` | 31 |

## Interfaces

- **Backend endpoints called (via `/backend`):**
  - `GET /backend/drops?orgId=${orgId}&limit=50` (L45)
  - `DELETE /backend/drops/${deleteTargetId}?orgId=${orgId}` (L63)

## Dependencies

- **Internal:**
  - `lib/api.ts` — `api`
  - `lib/auth.ts` — `getToken`, `getUserIdFromToken`
  - `components/dashboard/drops/DropVideoPlayer.tsx` — `DropVideoPlayer (default)`
  - `components/dashboard/drops/DeleteConfirmModal.tsx` — `DeleteConfirmModal (default)`
- **Packages:**
  - `react` — `useState`, `useEffect`, `useCallback`
  - `lucide-react` — `Trash2`, `Eye`, `Pencil`, `Loader2`, `Save`, `X`, …

## Used by

- `components/dashboard/DropsPage.tsx`
