# `components/garage-admin/CompleteProfileDialog.tsx`

> React component `CompleteProfileDialog`.

**Kind:** React component · **Lines:** 188 · **Directive:** `"use client"`

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Composition

**Renders:** `UserCheck` (lucide-react), `X` (lucide-react), `Loader2` (lucide-react)

### Props

- **`CompleteProfileDialog`**: `open: boolean`, `user: { id: string; name: string | null; email: string | null; phone?…`, `onCancel: () => void`, `onDone: () => void`

**Hooks used:** `useState`×4, `useEffect`

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `default (CompleteProfileDialog)` | component | `CompleteProfileDialog({ open, user, onCancel, onDone, }: { open: boolean; user: {…)` — Fill in a user's profile on their behalf. | 18 |

## Interfaces

None detected: no endpoints, events, data access or environment reads were found.

## Dependencies

- **Internal:**
  - `lib/admin-api/danger-zone.ts` — `completeUserProfile`
- **Packages:**
  - `react` — `useEffect`, `useState`
  - `lucide-react` — `Loader2`, `UserCheck`, `X`

## Used by

- `app/garage-admin/(admin-dashboard)/users/page.tsx`
