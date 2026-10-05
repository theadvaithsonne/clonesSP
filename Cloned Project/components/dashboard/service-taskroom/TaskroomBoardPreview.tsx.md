# `components/dashboard/service-taskroom/TaskroomBoardPreview.tsx`

> Read-only render of the Section 6 board as Taskroom itself draws it.

**Kind:** React component · **Lines:** 240 · **Directive:** `"use client"`

<!-- docgen:auto -->

## Purpose
Read-only render of the Section 6 board as Taskroom itself draws it.

The editor above this component optimises for editing — flat rows, inline
inputs, no colour. That makes it hard to tell what a client will actually
open. This mirrors the real board instead: coloured column headers, the card
layout from `componentsSymbol/task-card.tsx` (priority chip top-right, title,
subtask checklist, footer), and the "No tasks yet" empty state.

It is a simulator over local wizard state — it never calls Taskroom.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Composition

**Renders:** `CheckCircle2` (lucide-react), `Circle` (lucide-react), `Plus` (lucide-react), `Lock` (lucide-react), `Eye` (lucide-react), `PreviewCard` (local)

### Props

- **`TaskroomBoardPreview`**: `stages: ServiceStageTemplate[]`

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `TaskroomBoardPreview` | component | `TaskroomBoardPreview({ stages, }: { stages: ServiceStageTemplate[]; })` | 167 |

## Interfaces

None detected: no endpoints, events, data access or environment reads were found.

## Dependencies

- **Internal:**
  - `lib/utils.ts` — `cn`
  - `lib/feed-api.ts` — `ServiceStageTemplate`, `ServiceTaskTemplate`, `(types only)`
- **Packages:**
  - `lucide-react` — `CheckCircle2`, `Circle`, `Eye`, `Lock`, `Plus`

## Used by

- `components/dashboard/service-taskroom/TaskroomVisibilitySection.tsx`
