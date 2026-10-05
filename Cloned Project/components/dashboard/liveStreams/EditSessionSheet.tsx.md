# `components/dashboard/liveStreams/EditSessionSheet.tsx`

> Editing ONE session of a recurring live stream.

**Kind:** React component · **Lines:** 569 · **Directive:** `"use client"`

<!-- docgen:auto -->

## Purpose
Editing ONE session of a recurring live stream.

A series is a template plus a recurrence rule; its sessions are computed,
not stored. So this panel doesn't edit a row — it writes an override keyed
by the session's canonical day, and every field left untouched keeps
inheriting from the series.

Two things that shape the UI:

  INHERITED IS NOT EMPTY. A blank field means "use the series value", and
  the placeholder shows what that value is. Clearing a field you had
  customised sends `null`, which drops the override rather than storing an
  empty string.

  MOVING A SESSION DOESN'T RENAME IT. The date picker changes when the
  session runs. Its identity stays the day the recurrence rule produced — […]

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Composition

**Renders:** `Field`×7 (local), `Hint`×6 (local), `Label`×2 (local), `TimeSelector`×2 (components/dashboard/TimeSelector.tsx), `DrawerShell` (components/dashboard/liveStreams/DrawerShell.tsx), `FormSkeleton` (local), `X` (lucide-react), `Loader2` (lucide-react), `Upload` (lucide-react), `RotateCcw` (lucide-react)

### Props

- **`EditSessionSheet`**: `target: EditSessionTarget | null`, `orgId: string | null`, `onClose: () => void`, `onSaved: () => void`

**Hooks used:** `useState`×9, `useRef`, `useEffect`, `useCallback`, `useMemo`

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `EditSessionTarget` | interface |  | 124 |
| `EditSessionSheet` | component | `EditSessionSheet({ target, orgId, onClose, onSaved, }: { target: EditSession…)` | 132 |

## Interfaces

- **Backend endpoints called (via `/backend`):**
  - `POST /backend/upload` (L210)
- **Environment variables (`process.env`):** `NEXT_PUBLIC_API_URL`

## Dependencies

- **Internal:**
  - `lib/feed-api.ts` — `getWorkshopSessionDetail`, `revertWorkshopSession`, `updateWorkshopSession`, `WorkshopSessionEdit`, `WorkshopSessionEditPayload`, `WorkshopSessionSeriesDefaults`
  - `lib/auth.ts` — `getToken`
  - `components/dashboard/TimeSelector.tsx` — `TimeSelector`
  - `components/dashboard/liveStreams/DrawerShell.tsx` — `DrawerShell`
- **Packages:**
  - `react` — `useCallback`, `useEffect`, `useMemo`, `useRef`, `useState`
  - `sonner` — `toast`
  - `lucide-react` — `Loader2`, `RotateCcw`, `Upload`, `X`

## Used by

- `components/dashboard/WorkshopsPage.tsx`
