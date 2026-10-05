# `components/feed/PollCreator.tsx`

> React component `PollCreator`.

**Kind:** React component · **Lines:** 239 · **Directive:** `"use client"`

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Composition

**Renders:** `X`×2 (lucide-react), `Input`×2 (components/ui/input.tsx), `BarChart3` (lucide-react), `Plus` (lucide-react), `Clock` (lucide-react)

### Props

- **`PollCreator`**: `onPollChange: (poll: PollData | null) => void`, `onRemove: () => void`

**Hooks used:** `useState`×5

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `PollCreator` | component | `PollCreator({ onPollChange, onRemove }: PollCreatorProps)` | 35 |

## Interfaces

None detected: no endpoints, events, data access or environment reads were found.

## Dependencies

- **Internal:**
  - `lib/utils.ts` — `cn`
  - `components/ui/button.tsx` — `Button`
  - `components/ui/input.tsx` — `Input`
- **Packages:**
  - `react` — `useState`
  - `lucide-react` — `X`, `Plus`, `Clock`, `BarChart3`

## Used by

- `components/feed/CreatePostModal.tsx`
- `components/feed/InlinePostComposer.tsx`
