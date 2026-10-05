# `components/dashboard/jobs/candidate/SavedPage.tsx`

> B6 · Saved — bookmarked jobs and job alerts in one place.

**Kind:** React component · **Lines:** 232 · **Directive:** `"use client"`

<!-- docgen:auto -->

## Purpose
B6 · Saved — bookmarked jobs and job alerts in one place. Alerts email the
member when a new role matches; every alert can be paused, edited or
deleted, and chooses its own frequency.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Composition

**Renders:** `Button`×4 (components/dashboard/jobs/ui.tsx), `Card`×3 (components/dashboard/jobs/ui.tsx), `Plus`×2 (lucide-react), `LoadingBlock`×2 (components/dashboard/jobs/ui.tsx), `ErrorState`×2 (components/dashboard/jobs/ui.tsx), `EmptyState`×2 (components/dashboard/jobs/ui.tsx), `Bell`×2 (lucide-react), `PageHeader` (components/dashboard/jobs/ui.tsx), `UnderlineTabs` (components/dashboard/jobs/ui.tsx), `SavedJobs` (local), `Alerts` (local), `AlertModal` (components/dashboard/jobs/candidate/AlertModal.tsx), `Bookmark` (lucide-react), `SearchInput` (components/dashboard/jobs/ui.tsx), `JobCard` (components/dashboard/jobs/candidate/shared.tsx), `RowMenu` (components/dashboard/jobs/ui.tsx), `Pencil` (lucide-react), `Pause` (lucide-react), `Play` (lucide-react), `Trash2` (lucide-react)

**Hooks used:** `useSavedStore`×3 (components/dashboard/jobs/candidate/boardNav.tsx), `useBoardStore`×2 (components/dashboard/jobs/candidate/boardNav.tsx), `useLoad`×2 (components/dashboard/jobs/ui.tsx), `useBoardNav` (components/dashboard/jobs/candidate/boardNav.tsx), `useConfirm` (components/dashboard/jobs/ui.tsx)

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `default (SavedPage)` | component | `SavedPage()` | 32 |

## Interfaces

None detected: no endpoints, events, data access or environment reads were found.

## Dependencies

- **Internal:**
  - `components/dashboard/jobs/ui.tsx` — `Button`, `Card`, `EmptyState`, `ErrorState`, `GOLD`, `LoadingBlock`, `PageHeader`, `RowMenu`, … +6
  - `components/dashboard/jobs/candidate/AlertModal.tsx` — `AlertModal (default)`, `criteriaSummary`, `frequencyLabel`
  - `components/dashboard/jobs/candidate/boardNav.tsx` — `BOARD_PAGES`, `SavedTab`, `useBoardNav`, `useBoardStore`, `useSavedStore`
  - `components/dashboard/jobs/candidate/candidateApi.ts` — `* as candidateApi`
  - `components/dashboard/jobs/candidate/candidateTypes.ts` — `JobAlert`, `PublicJob`, `(types only)`
  - `components/dashboard/jobs/candidate/shared.tsx` — `JobCard`
- **Packages:**
  - `react`
  - `lucide-react` — `Bell`, `Bookmark`, `Pause`, `Pencil`, `Play`, `Plus`, …
  - `sonner` — `toast`

## Used by

- `components/dashboard/jobs/candidate/CandidateJobsApp.tsx`
