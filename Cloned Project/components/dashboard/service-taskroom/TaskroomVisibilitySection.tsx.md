# `components/dashboard/service-taskroom/TaskroomVisibilitySection.tsx`

> Section 6 of the Create Digital Service wizard: "Taskroom & Customer Visibility".

**Kind:** React component · **Lines:** 845 · **Directive:** `"use client"`

<!-- docgen:auto -->

## Purpose
Section 6 of the Create Digital Service wizard: "Taskroom & Customer
Visibility".

Two halves:
 - a board layout editor, seeded from the milestones entered in Section 3,
   that defines the Kanban columns and default tasks cloned into every
   client's engagement room;
 - the five Client Access Permission switches.

The `isInternal` flag on a column, and the `internal` task kind, decide what
the client never sees. Both are advisory here — the actual boundary is
enforced by the board proxy on the server, because a browser-side filter
would still ship internal cards over the wire.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Composition

**Renders:** `Switch`×2 (components/ui/switch.tsx), `Icon`×2 (local), `Eye`×2 (lucide-react), `X`×2 (lucide-react), `Info` (lucide-react), `TaskroomDestinationPicker` (components/dashboard/service-taskroom/TaskroomDestinationPicker.tsx), `Plus` (lucide-react), `TaskroomBoardPreview` (components/dashboard/service-taskroom/TaskroomBoardPreview.tsx), `Lock` (lucide-react), `Trash2` (lucide-react)

### Props

- **`TaskroomVisibilitySection`**: `config: ServiceTaskroomConfig`, `onChange: (next: ServiceTaskroomConfig) => void`, `milestones: MilestoneLike[]`, `serviceTitle?: string`, `billable?: boolean`, `assignableMembers?: ServiceTaskAssignee[]`

**Hooks used:** `useState`×3, `useMemo`, `useEffect`

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `MilestoneLike` | interface | Minimal shape this section needs from the wizard's milestone state. | 53 |
| `isCompletedStage` | function | `isCompletedStage(stage: ServiceStageTemplate)` — A column is the pinned Completed one when it is the board's `done` stage. | 74 |
| `ensureCompletedStage` | function | `ensureCompletedStage(stages: ServiceStageTemplate[]): ServiceStageTemplate[]` — Guarantee a client-visible Completed column, and keep the column order meaningful: working columns, then Completed, then the internal ones. | 85 |
| `buildDefaultStages` | function | `buildDefaultStages(milestones: MilestoneLike[], billable = false): ServiceStageTemplate[]` — Derive the default board from the milestones in Section 3: one column per milestone holding that milestone's card, a Completed column, plus an internal column the client never sees. | 134 |
| `syncStagesWithMilestones` | function | `syncStagesWithMilestones(stages: ServiceStageTemplate[], milestones: MilestoneLike[]): ServiceStageTemplate[]` — Re-seed milestone columns from the current milestone list while preserving every edit the founder has already made. | 173 |
| `TaskroomVisibilitySection` | component | `TaskroomVisibilitySection({ config, onChange, milestones, serviceTitle, billable = fa…)` | 268 |
| `emptyTaskroomConfig` | function | `emptyTaskroomConfig(): ServiceTaskroomConfig` — Config used for services that have never been through Section 6. | 838 |

## Interfaces

None detected: no endpoints, events, data access or environment reads were found.

## Dependencies

- **Internal:**
  - `components/ui/switch.tsx` — `Switch`
  - `components/dashboard/service-taskroom/TaskroomDestinationPicker.tsx` — `TaskroomDestinationPicker`
  - `components/dashboard/service-taskroom/TaskroomBoardPreview.tsx` — `TaskroomBoardPreview`
  - `lib/utils.ts` — `cn`
  - `lib/feed-api.ts` — `ServiceClientAccess`, `ServiceStageTemplate`, `ServiceTaskAssignee`, `ServiceTaskTemplate`, `ServiceTaskroomConfig`, `(types only)`
  - `lib/feed-api.ts` — `DEFAULT_CLIENT_ACCESS`
- **Packages:**
  - `react` — `useEffect`, `useMemo`, `useState`
  - `lucide-react` — `Activity`, `Eye`, `Folder`, `GaugeCircle`, `Info`, `KanbanSquare`, …

## Used by

- `components/dashboard/ServiceFormModal.tsx`
