# `components/nc-admin/axons/unmerge-dialog.tsx`

> React component `UnmergeDialog`.

**Kind:** React component · **Lines:** 290 · **Directive:** `"use client"`

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Composition

**Renders:** `Metric`×3 (local), `GitPullRequestArrow`×2 (lucide-react), `Loader2`×2 (lucide-react), `X` (lucide-react), `AlertTriangle` (lucide-react)

### Props

- **`UnmergeDialog`**: `initialLogId?: string`, `onClose: () => void`, `onUnmerged: (result: UnmergeResult) => void`

**Hooks used:** `useState`×7, `useRef`×2, `useEffect`

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `UnmergeDialog` | component | `UnmergeDialog({ initialLogId = "", onClose, onUnmerged, }: { initialLogId…)` — Two-step unmerge flow: DRY-RUN (by merge-log id) → impact diff → CONFIRM. | 19 |

## Interfaces

None detected: no endpoints, events, data access or environment reads were found.

## Dependencies

- **Internal:**
  - `lib/nc-admin-api/admin-axons.ts` — `dryRunUnmerge`, `confirmUnmerge`, `isValidObjectId`, `UnmergeResult`, `MergeImpact`, `AxonSurfaceDisabledError`
  - `lib/nc-admin-api/admin.ts` — `AdminUnauthorizedError`, `AdminApiError`
  - `lib/nc-admin-api/auth.ts` — `ensureNcAdminToken`
- **Packages:**
  - `react` — `useEffect`, `useRef`, `useState`
  - `lucide-react` — `Loader2`, `GitPullRequestArrow`, `AlertTriangle`, `X`

## Used by

- `app/garage-admin/(admin-dashboard)/networkchains/axons/[axonId]/page.tsx`
