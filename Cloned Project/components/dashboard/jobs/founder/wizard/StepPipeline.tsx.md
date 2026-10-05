# `components/dashboard/jobs/founder/wizard/StepPipeline.tsx`

> A7 · Step 4 — Pipeline & team: the hiring stages (Applied first and Hired last stay fixed), each stage's owner and auto-actions, the hiring team (office members only) and which candidate emails go out automatically.

**Kind:** React component · **Lines:** 526 · **Directive:** `"use client"`

<!-- docgen:auto -->

## Purpose
A7 · Step 4 — Pipeline & team: the hiring stages (Applied first and Hired
last stay fixed), each stage's owner and auto-actions, the hiring team
(office members only) and which candidate emails go out automatically.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Composition

**Renders:** `Card`×3 (components/dashboard/jobs/ui.tsx), `StageRow`×3 (local), `EmailToggle`×3 (local), `Plus`×2 (lucide-react), `Avatar`×2 (components/dashboard/jobs/ui.tsx), `X`×2 (lucide-react), `StepHeading` (components/dashboard/jobs/founder/wizard/StepBasics.tsx), `Button` (components/dashboard/jobs/ui.tsx), `DndContext` (@dnd-kit/core), `SortableContext` (@dnd-kit/sortable), `SortableStage` (local), `UserPlus` (lucide-react), `SwitchControl` (components/dashboard/jobs/ui.tsx), `GripVertical` (lucide-react), `Lock` (lucide-react), `Zap` (lucide-react), `ChevronDown` (lucide-react), `Trash2` (lucide-react)

### Props

- **`StepPipeline`**: `props: StepProps`

**Hooks used:** `useLoad`×2 (components/dashboard/jobs/ui.tsx), `useJobsNav` (components/dashboard/jobs/nav.tsx), `useSensors` (@dnd-kit/core), `useSensor` (@dnd-kit/core), `useSortable` (@dnd-kit/sortable)

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `default (StepPipeline)` | component | `StepPipeline({ job, detail, update }: StepProps)` | 28 |

## Interfaces

None detected: no endpoints, events, data access or environment reads were found.

## Dependencies

- **Internal:**
  - `components/dashboard/jobs/api.ts` — `* as jobsApi`
  - `components/dashboard/jobs/constants.ts` — `CATEGORY_META`, `JOB_PAGES`, `STAGE_CATEGORIES`, `TEAM_ROLE_META`, `newId`
  - `components/dashboard/jobs/nav.tsx` — `useJobsNav`
  - `components/dashboard/jobs/ui.tsx` — `Avatar`, `Button`, `Card`, `GOLD`, `SwitchControl`, `useLoad`
  - `components/dashboard/jobs/types.ts` — `AutoAction`, `OfficeMember`, `Stage`, `StageCategory`, `TeamRole`, `(types only)`
  - `components/dashboard/jobs/founder/wizard/JobWizard.tsx` — `StepProps`, `(types only)`
  - `components/dashboard/jobs/founder/wizard/StepBasics.tsx` — `StepHeading`
- **Packages:**
  - `react`
  - `@dnd-kit/core` — `DndContext`, `PointerSensor`, `closestCenter`, `useSensor`, `useSensors`, `DragEndEvent`
  - `@dnd-kit/sortable` — `SortableContext`, `arrayMove`, `useSortable`, `verticalListSortingStrategy`
  - `@dnd-kit/utilities` — `CSS`
  - `lucide-react` — `ChevronDown`, `GripVertical`, `Lock`, `Plus`, `Trash2`, `UserPlus`, …
  - `sonner` — `toast`

## Used by

- `components/dashboard/jobs/founder/wizard/JobWizard.tsx`
