# `components/dashboard/jobs/founder/workspace/PipelineBoard.tsx`

> A11 / F2 · Pipeline kanban.

**Kind:** React component · **Lines:** 537 · **Directive:** `"use client"`

<!-- docgen:auto -->

## Purpose
A11 / F2 · Pipeline kanban.

One frosted-glass column per stage on the app's normal dark background.
Cards are "liquid glass" too: a translucent gradient with a soft blur, a
bright rim and a specular highlight. Dragging lifts a see-through glass copy (DragOverlay) that tilts
with the pointer so the board stays visible through it, while the card's
slot moves live into the hovered column — the dashed ghost shows exactly
where it will land and the other cards spring out of the way. Dropping on a
Hired stage springs the card back and opens the hire confirmation instead.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Composition

**Renders:** `FilterMenu`×4 (components/dashboard/jobs/ui.tsx), `GlassCard`×2 (local), `ErrorState` (components/dashboard/jobs/ui.tsx), `LoadingBlock` (components/dashboard/jobs/ui.tsx), `SearchInput` (components/dashboard/jobs/ui.tsx), `DndContext` (@dnd-kit/core), `Column` (local), `Outcomes` (local), `DragOverlay` (@dnd-kit/core), `LiftedCard` (local), `Icon` (local), `DraggableCard` (local)

### Props

- **`PipelineBoard`**: `jobId: string`, `refreshKey: number`, `onOpen: (applicationId: string, ordered: string[]) => void`, `onHireDrop: (applicationId: string, ordered: string[]) => void`, `onShowOutcome: (status: "rejected" | "withdrawn") => void`

**Hooks used:** `useSensor`×2 (@dnd-kit/core), `useReducedMotion`×2 (framer-motion), `useSensors` (@dnd-kit/core), `useDroppable` (@dnd-kit/core), `useDraggable` (@dnd-kit/core)

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `default (PipelineBoard)` | component | `PipelineBoard({ jobId, refreshKey, onOpen, onHireDrop, onShowOutcome, }: …)` | 72 |

## Interfaces

- **Timers / queues:** `setTimeout` at L103

## Dependencies

- **Internal:**
  - `components/dashboard/jobs/api.ts` — `* as jobsApi`
  - `components/dashboard/jobs/constants.ts` — `CATEGORY_META`, `SOURCE_LABELS`
  - `components/dashboard/jobs/ui.tsx` — `ErrorState`, `FilterMenu`, `LoadingBlock`, `SearchInput`, `errorMessage`
  - `components/dashboard/jobs/types.ts` — `PipelineCard`, `PipelineResponse`, `Stage`, `StageCategory`, `(types only)`
- **Packages:**
  - `react`
  - `@dnd-kit/core` — `DndContext`, `DragOverlay`, `PointerSensor`, `TouchSensor`, `defaultDropAnimationSideEffects`, `pointerWithin`, …
  - `framer-motion` — `motion`, `useReducedMotion`
  - `lucide-react` — `BadgeCheck`, `CircleDot`, `ClipboardCheck`, `FileSignature`, `MessagesSquare`, `ScanSearch`, …
  - `sonner` — `toast`

## Used by

- `components/dashboard/jobs/founder/workspace/JobWorkspace.tsx`
