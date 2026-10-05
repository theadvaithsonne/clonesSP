# `components/dashboard/jobs/founder/PostingsPage.tsx`

> A2 · Postings — every role the office has created, by status, with the row actions (pipeline, edit, duplicate, pause, copy link, close, delete).

**Kind:** React component · **Lines:** 419 · **Directive:** `"use client"`

<!-- docgen:auto -->

## Purpose
A2 · Postings — every role the office has created, by status, with the row
actions (pipeline, edit, duplicate, pause, copy link, close, delete).

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Composition

**Renders:** `Button`×7 (components/dashboard/jobs/ui.tsx), `FilterMenu`×4 (components/dashboard/jobs/ui.tsx), `Pencil`×2 (lucide-react), `Globe`×2 (lucide-react), `Plus`×2 (lucide-react), `Card`×2 (components/dashboard/jobs/ui.tsx), `Kanban` (lucide-react), `Copy` (lucide-react), `Pause` (lucide-react), `Play` (lucide-react), `XCircle` (lucide-react), `Trash2` (lucide-react), `PageHeader` (components/dashboard/jobs/ui.tsx), `UnderlineTabs` (components/dashboard/jobs/ui.tsx), `SearchInput` (components/dashboard/jobs/ui.tsx), `SkeletonRows` (components/dashboard/jobs/ui.tsx), `ErrorState` (components/dashboard/jobs/ui.tsx), `EmptyState` (components/dashboard/jobs/ui.tsx), `Briefcase` (lucide-react), `StatusPill` (components/dashboard/jobs/ui.tsx), `StageBar` (components/dashboard/jobs/ui.tsx), `Building2` (lucide-react), `GraduationCap` (lucide-react), `RowMenu` (components/dashboard/jobs/ui.tsx), `DeleteModal` (local), `Modal` (components/dashboard/jobs/ui.tsx)

**Hooks used:** `useJobsNav` (components/dashboard/jobs/nav.tsx), `useConfirm` (components/dashboard/jobs/ui.tsx), `useReferralLink` (components/dashboard/jobs/useReferralLink.ts), `useLoad` (components/dashboard/jobs/ui.tsx)

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `default (PostingsPage)` | component | `PostingsPage()` | 51 |

## Interfaces

- **Timers / queues:** `setTimeout` at L66

## Dependencies

- **Internal:**
  - `components/dashboard/jobs/api.ts` — `* as jobsApi`
  - `components/dashboard/jobs/constants.ts` — `JOB_PAGES`
  - `components/dashboard/jobs/nav.tsx` — `useJobsNav`
  - `components/dashboard/jobs/useReferralLink.ts` — `useReferralLink`
  - `components/dashboard/jobs/ui.tsx` — `Button`, `Card`, `EmptyState`, `ErrorState`, `FilterMenu`, `GOLD`, `Modal`, `PageHeader`, … +11
  - `components/dashboard/jobs/types.ts` — `PostingRow`, `(types only)`
- **Packages:**
  - `react`
  - `lucide-react` — `Briefcase`, `Building2`, `Copy`, `Globe`, `GraduationCap`, `Kanban`, …
  - `sonner` — `toast`

## Used by

- `components/dashboard/jobs/founder/FounderJobsApp.tsx`
