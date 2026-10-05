# `components/dashboard/jobs/candidate/MyApplicationsPage.tsx`

> B5 / F7 · My Applications — every application the member has made, with the stage they're at (as broad categories only), what happens next, interview slots to pick, offers to accept or decline, and drafts to finish.

**Kind:** React component · **Lines:** 559 · **Directive:** `"use client"`

<!-- docgen:auto -->

## Purpose
B5 / F7 · My Applications — every application the member has made, with
the stage they're at (as broad categories only), what happens next,
interview slots to pick, offers to accept or decline, and drafts to finish.
A rejection shows as "Not moving forward" with no detail — screening
decisions stay private to the office.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Composition

**Renders:** `Button`×13 (components/dashboard/jobs/ui.tsx), `Card`×4 (components/dashboard/jobs/ui.tsx), `OrgLogo`×3 (components/dashboard/jobs/ui.tsx), `RowMenu`×2 (components/dashboard/jobs/ui.tsx), `PageHeader` (components/dashboard/jobs/ui.tsx), `UnderlineTabs` (components/dashboard/jobs/ui.tsx), `LoadingBlock` (components/dashboard/jobs/ui.tsx), `ErrorState` (components/dashboard/jobs/ui.tsx), `PartyPopper` (lucide-react), `EmptyState` (components/dashboard/jobs/ui.tsx), `Briefcase` (lucide-react), `ApplicationCard` (local), `OfferDrawer` (local), `React` (react), `ProgressTrack` (local), `InterviewRow` (local), `Check` (lucide-react), `Video` (lucide-react), `CalendarPlus` (lucide-react), `Clock` (lucide-react), `Drawer` (components/dashboard/jobs/ui.tsx), `FileText` (lucide-react), `TextArea` (components/dashboard/jobs/ui.tsx)

**Hooks used:** `useBoardStore`×2 (components/dashboard/jobs/candidate/boardNav.tsx), `useBoardNav` (components/dashboard/jobs/candidate/boardNav.tsx), `useLoad` (components/dashboard/jobs/ui.tsx), `useConfirm` (components/dashboard/jobs/ui.tsx)

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `default (MyApplicationsPage)` | component | `MyApplicationsPage()` | 101 |

## Interfaces

- **External hosts mentioned in the code:** `calendar.google.com`

## Dependencies

- **Internal:**
  - `components/dashboard/jobs/ui.tsx` — `Button`, `Card`, `Drawer`, `EmptyState`, `ErrorState`, `GOLD`, `LoadingBlock`, `OrgLogo`, … +11
  - `components/dashboard/jobs/candidate/boardNav.tsx` — `BOARD_PAGES`, `ApplicationsTab`, `useBoardNav`, `useBoardStore`
  - `components/dashboard/jobs/candidate/candidateApi.ts` — `* as candidateApi`
  - `components/dashboard/jobs/candidate/candidateTypes.ts` — `MyApplication`, `MyInterview`, `(types only)`
  - `components/dashboard/jobs/candidate/shared.tsx` — `processLabel`
- **Packages:**
  - `react`
  - `lucide-react` — `Briefcase`, `CalendarPlus`, `Check`, `Clock`, `FileText`, `PartyPopper`, …
  - `sonner` — `toast`

## Used by

- `components/dashboard/jobs/candidate/CandidateJobsApp.tsx`
