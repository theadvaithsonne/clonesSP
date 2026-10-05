# `components/office/MemosPanel.tsx`

> React component `MemosPanel`.

**Kind:** React component · **Lines:** 333 · **Directive:** `"use client"`

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Composition

**Renders:** `Mic`×2 (lucide-react), `Loader2`×2 (lucide-react), `Square` (lucide-react), `Pause` (lucide-react), `Play` (lucide-react), `X` (lucide-react), `Save` (lucide-react), `RefreshCw` (lucide-react), `MemoRow` (local), `Trash2` (lucide-react)

### Props

- **`MemosPanel`**: `memos: VoiceMemo[]`, `loading: boolean`, `error: string | null`, `uploading: boolean`, `recorderState: MemoState`, `elapsed: number`, `recorderError: string | null`

**Hooks used:** `useState`×2

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `default (MemosPanel)` | component | `MemosPanel({ memos, loading, error, uploading, onRefresh, onDelete, re…)` — Voice memo sidebar tab. | 48 |

## Interfaces

None detected: no endpoints, events, data access or environment reads were found.

## Dependencies

- **Internal:**
  - `lib/utils.ts` — `cn`
  - `hooks/office/useVoiceMemos.ts` — `VoiceMemo`, `(types only)`
  - `hooks/office/useMemoRecorder.ts` — `MemoState`, `(types only)`
- **Packages:**
  - `react` — `useState`
  - `lucide-react` — `Loader2`, `Mic`, `Pause`, `Play`, `Save`, `Square`, …
  - `sonner` — `toast`

## Used by

- `app/meet/conference/[orgId]/[roomId]/ConferenceCallStandalone.tsx`
