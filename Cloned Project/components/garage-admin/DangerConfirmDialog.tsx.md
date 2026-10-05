# `components/garage-admin/DangerConfirmDialog.tsx`

> React component `DangerConfirmDialog`.

**Kind:** React component · **Lines:** 273 · **Directive:** `"use client"`

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Composition

**Renders:** `Loader2`×2 (lucide-react), `AlertTriangle` (lucide-react), `X` (lucide-react), `AffectedAvatar` (local)

### Props

- **`DangerConfirmDialog`**: `open: boolean`, `title: string`, `subject: string`, `confirmValue: string`, `confirmLabel: string`, `dependents: DependentCount[]`, `totalDependents: number`, `countsCapped?: boolean`, `affected?: AffectedUser[]`, `extraNote?: string | null`, `loading?: boolean`, `busy?: boolean`, `error?: string | null`, `onCancel: () => void`, `onConfirm: () => void`

**Hooks used:** `useEffect`×2, `useState`

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `AffectedUser` | interface | One person a destructive action will hit. | 8 |
| `default (DangerConfirmDialog)` | component | `DangerConfirmDialog({ open, title, subject, confirmValue, confirmLabel, depende…)` — Confirmation for a permanent delete. | 28 |

## Interfaces

None detected: no endpoints, events, data access or environment reads were found.

## Dependencies

- **Internal:**
  - `lib/admin-api/danger-zone.ts` — `DependentCount`, `(types only)`
- **Packages:**
  - `react` — `useEffect`, `useState`
  - `lucide-react` — `AlertTriangle`, `Loader2`, `X`

## Used by

- `app/garage-admin/(admin-dashboard)/companies/page.tsx`
- `app/garage-admin/(admin-dashboard)/organizations/page.tsx`
- `app/garage-admin/(admin-dashboard)/users/page.tsx`
