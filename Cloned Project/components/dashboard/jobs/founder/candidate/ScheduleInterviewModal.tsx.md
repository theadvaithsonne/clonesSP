# `components/dashboard/jobs/founder/candidate/ScheduleInterviewModal.tsx`

> A13 · Schedule interview: round, interviewers, up to six time slots (sent as a fixed time, or offered for the candidate to pick), duration, mode.

**Kind:** React component · **Lines:** 247 · **Directive:** `"use client"`

<!-- docgen:auto -->

## Purpose
A13 · Schedule interview: round, interviewers, up to six time slots (sent as
a fixed time, or offered for the candidate to pick), duration, mode. Video
interviews get a Garage meeting link created automatically.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Composition

**Renders:** `Label`×3 (components/dashboard/jobs/ui.tsx), `Button`×2 (components/dashboard/jobs/ui.tsx), `CustomSelect`×2 (components/dashboard/jobs/ui.tsx), `Chip`×2 (components/dashboard/jobs/ui.tsx), `Modal` (components/dashboard/jobs/ui.tsx), `Avatar` (components/dashboard/jobs/ui.tsx), `Toggle` (components/dashboard/jobs/ui.tsx), `X` (lucide-react), `Plus` (lucide-react), `Video` (lucide-react), `TextInput` (components/dashboard/jobs/ui.tsx), `TextArea` (components/dashboard/jobs/ui.tsx)

### Props

- **`ScheduleInterviewModal`**: `open: boolean`, `applicationId: string`, `candidateName: string`, `jobTitle: string`, `stages: Stage[]`, `currentStageId: string`, `team: TeamMember[]`, `onClose: () => void`, `onDone: () => void`

**Hooks used:** `useLoad` (components/dashboard/jobs/ui.tsx)

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `default (ScheduleInterviewModal)` | component | `ScheduleInterviewModal({ open, applicationId, candidateName, jobTitle, stages, cur…)` | 35 |

## Interfaces

None detected: no endpoints, events, data access or environment reads were found.

## Dependencies

- **Internal:**
  - `components/dashboard/jobs/api.ts` — `* as jobsApi`
  - `components/dashboard/jobs/ui.tsx` — `Avatar`, `Button`, `Chip`, `CustomSelect`, `Label`, `Modal`, `TextArea`, `TextInput`, … +5
  - `components/dashboard/jobs/types.ts` — `Stage`, `TeamMember`, `(types only)`
- **Packages:**
  - `react`
  - `lucide-react` — `Plus`, `Video`, `X`
  - `sonner` — `toast`

## Used by

- `components/dashboard/jobs/founder/candidate/CandidateDrawer.tsx`
