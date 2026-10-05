# `components/dashboard/drops/AllDropsTab.tsx`

> React component `AllDropsTab`.

**Kind:** React component · **Lines:** 282 · **Directive:** `"use client"`

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Composition

**Renders:** `Loader2` (lucide-react), `Play` (lucide-react), `Clock` (lucide-react), `Eye` (lucide-react), `Heart` (lucide-react), `Share2` (lucide-react), `Trash2` (lucide-react), `X` (lucide-react), `DropVideoPlayer` (components/dashboard/drops/DropVideoPlayer.tsx), `DeleteConfirmModal` (components/dashboard/drops/DeleteConfirmModal.tsx)

### Props

- **`AllDropsTab`**: `orgId: string`, `onDeleted: (id: string) => void`

**Hooks used:** `useState`×5, `useCallback`, `useEffect`

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `default (AllDropsTab)` | component | `AllDropsTab({ orgId, onDeleted }: AllDropsTabProps)` | 30 |

## Interfaces

- **Backend endpoints called (via `/backend`):**
  - `GET /backend/drops?orgId=${orgId}&limit=50` (L41)
  - `DELETE /backend/drops/${deleteTargetId}?orgId=${orgId}` (L56)

## Dependencies

- **Internal:**
  - `lib/api.ts` — `api`
  - `lib/auth.ts` — `getToken`
  - `components/dashboard/drops/DropVideoPlayer.tsx` — `DropVideoPlayer (default)`
  - `components/dashboard/drops/DeleteConfirmModal.tsx` — `DeleteConfirmModal (default)`
- **Packages:**
  - `react` — `useState`, `useEffect`, `useCallback`
  - `lucide-react` — `Trash2`, `Eye`, `Heart`, `Share2`, `Clock`, `Loader2`, …

## Used by

- `components/dashboard/DropsPage.tsx`
