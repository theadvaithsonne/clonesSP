# `components/nc-admin/axons/merge-dialog.tsx`

> React component `MergeDialog`.

**Kind:** React component · **Lines:** 352 · **Directive:** `"use client"`

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Composition

**Renders:** `Metric`×3 (local), `GitMerge`×2 (lucide-react), `Loader2`×2 (lucide-react), `X` (lucide-react), `ImpactView` (local), `AlertTriangle` (lucide-react), `ArrowRight` (lucide-react)

### Props

- **`MergeDialog`**: `axon: RawAxon`, `onClose: () => void`, `onMerged: (result: MergeResult) => void`

**Hooks used:** `useState`×6, `useRef`×2, `useEffect`

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `MergeDialog` | component | `MergeDialog({ axon, onClose, onMerged, }: { axon: RawAxon; onClose: () …)` — Two-step merge flow: DRY-RUN → impact diff → CONFIRM. | 22 |

## Interfaces

None detected: no endpoints, events, data access or environment reads were found.

## Dependencies

- **Internal:**
  - `lib/nc-admin-api/admin-axons.ts` — `dryRunMerge`, `confirmMerge`, `isValidObjectId`, `RawAxon`, `ForwardMergeImpact`, `MergeResult`, `AxonSurfaceDisabledError`
  - `lib/nc-admin-api/admin.ts` — `AdminUnauthorizedError`, `AdminApiError`
  - `lib/nc-admin-api/auth.ts` — `ensureNcAdminToken`
- **Packages:**
  - `react` — `useEffect`, `useRef`, `useState`
  - `lucide-react` — `Loader2`, `GitMerge`, `AlertTriangle`, `ArrowRight`, `X`

## Used by

- `app/garage-admin/(admin-dashboard)/networkchains/axons/[axonId]/page.tsx`
