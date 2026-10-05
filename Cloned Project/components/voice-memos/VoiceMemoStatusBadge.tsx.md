# `components/voice-memos/VoiceMemoStatusBadge.tsx`

> Status pill mirroring NC's voice-memo states (pending → transcribing → processing → ready, plus failed).

**Kind:** React component · **Lines:** 44

<!-- docgen:auto -->

## Purpose
Status pill mirroring NC's voice-memo states (pending → transcribing
→ processing → ready, plus failed). The label tracks pipeline stage
so the user knows whether the memo is still working.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Props

- **`VoiceMemoStatusBadge`**: `status: MemoStatus`

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `default (VoiceMemoStatusBadge)` | component | `VoiceMemoStatusBadge({ status, }: { status: MemoStatus; })` | 30 |

## Interfaces

None detected: no endpoints, events, data access or environment reads were found.

## Dependencies

- **Internal:**
  - `lib/api/voice-memos.ts` — `MemoStatus`, `(types only)`
- **Packages:** none

## Used by

- `components/voice-memos/VoiceMemoPanel.tsx`
