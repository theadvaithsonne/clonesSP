# `components/office/RecordingsPanel.tsx`

> React component `RecordingsPanel`.

**Kind:** React component · **Lines:** 276 · **Directive:** `"use client"`

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Composition

**Renders:** `Loader2`×2 (lucide-react), `Download`×2 (lucide-react), `RefreshCw` (lucide-react), `CircleDot` (lucide-react), `RecordingRow` (local), `PlayerModal` (local), `Play` (lucide-react), `Trash2` (lucide-react), `X` (lucide-react)

### Props

- **`RecordingsPanel`**: `recordings: ConferenceRecording[]`, `loading: boolean`, `error: string | null`

**Hooks used:** `useState`×2

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `default (RecordingsPanel)` | component | `RecordingsPanel({ recordings, loading, error, onRefresh, onDelete, }: Props)` — Recordings panel for the conference sidebar. | 32 |

## Interfaces

None detected: no endpoints, events, data access or environment reads were found.

## Dependencies

- **Internal:**
  - `lib/utils.ts` — `cn`
  - `hooks/office/useConferenceRecordings.ts` — `ConferenceRecording`, `(types only)`
- **Packages:**
  - `react` — `useState`
  - `lucide-react` — `CircleDot`, `Download`, `Loader2`, `Play`, `RefreshCw`, `Trash2`, …
  - `sonner` — `toast`

## Used by

- `app/meet/conference/[orgId]/[roomId]/ConferenceCallStandalone.tsx`
