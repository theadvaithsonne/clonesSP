# `components/dashboard/jobs/founder/candidate/CandidateDrawer.tsx`

> A12 · Candidate profile drawer — used by the pipeline, Applications, the Talent Pool and Payouts.

**Kind:** React component · **Lines:** 839 · **Directive:** `"use client"`

<!-- docgen:auto -->

## Purpose
A12 · Candidate profile drawer — used by the pipeline, Applications, the
Talent Pool and Payouts. Header: who they are, where they came from, match,
stage and the next move. Tabs: Application answers, Resume, Interviews,
Activity, Notes. Footer: schedule interview, reject, offer / next stage.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Composition

**Renders:** `Button`×8 (components/dashboard/jobs/ui.tsx), `Chip`×4 (components/dashboard/jobs/ui.tsx), `FileText`×3 (lucide-react), `CalendarClock`×3 (lucide-react), `Check`×2 (lucide-react), `Avatar` (components/dashboard/jobs/ui.tsx), `Star` (lucide-react), `MatchScore` (components/dashboard/jobs/ui.tsx), `TagAdder` (local), `Drawer` (components/dashboard/jobs/ui.tsx), `ChevronLeft` (lucide-react), `ChevronRight` (lucide-react), `LoadingBlock` (components/dashboard/jobs/ui.tsx), `UnderlineTabs` (components/dashboard/jobs/ui.tsx), `ApplicationTab` (local), `ResumeTab` (local), `InterviewsTab` (local), `ActivityTab` (local), `NotesTab` (local), `RejectModal` (components/dashboard/jobs/founder/candidate/RejectModal.tsx), `ScheduleInterviewModal` (components/dashboard/jobs/founder/candidate/ScheduleInterviewModal.tsx), `OfferDrawer` (components/dashboard/jobs/founder/candidate/OfferDrawer.tsx), `HireModal` (components/dashboard/jobs/founder/candidate/HireModal.tsx), `ExternalLink` (lucide-react), `Video` (lucide-react), `Loader2` (lucide-react), `X` (lucide-react)

### Props

- **`CandidateDrawer`**: `applicationId: string | null`, `onClose: () => void`, `onChanged?: () => void`, `siblings?: string[]`, `onSelect?: (applicationId: string) => void`, `initialAction?: "hire" | "offer" | "interview" | "reject" | null`

**Hooks used:** `useJobsNav` (components/dashboard/jobs/nav.tsx), `useLoad` (components/dashboard/jobs/ui.tsx)

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `CandidateDrawerProps` | interface |  | 47 |
| `default (CandidateDrawer)` | component | `CandidateDrawer({ applicationId, onClose, onChanged, siblings, onSelect, in…)` | 143 |

## Interfaces

None detected: no endpoints, events, data access or environment reads were found.

## Dependencies

- **Internal:**
  - `components/dashboard/jobs/api.ts` — `* as jobsApi`
  - `components/dashboard/jobs/constants.ts` — `CATEGORY_META`, `SOURCE_LABELS`, `FILE_TYPES`, `LAYOUT_TYPES`
  - `components/dashboard/jobs/nav.tsx` — `useJobsNav`
  - `components/dashboard/jobs/ui.tsx` — `Avatar`, `Button`, `Chip`, `Drawer`, `GOLD`, `LoadingBlock`, `MatchScore`, `UnderlineTabs`, … +6
  - `components/dashboard/jobs/types.ts` — `Answer`, `CandidateProfileResponse`, `FormField`, `Interview`, `(types only)`
  - `components/dashboard/jobs/founder/candidate/RejectModal.tsx` — `RejectModal (default)`
  - `components/dashboard/jobs/founder/candidate/ScheduleInterviewModal.tsx` — `ScheduleInterviewModal (default)`
  - `components/dashboard/jobs/founder/candidate/OfferDrawer.tsx` — `OfferDrawer (default)`
  - `components/dashboard/jobs/founder/candidate/HireModal.tsx` — `HireModal (default)`
- **Packages:**
  - `react`
  - `lucide-react` — `CalendarClock`, `Check`, `ChevronLeft`, `ChevronRight`, `ExternalLink`, `FileText`, …
  - `sonner` — `toast`

## Used by

- `components/dashboard/jobs/founder/ApplicationsPage.tsx`
- `components/dashboard/jobs/founder/TalentPoolPage.tsx`
- `components/dashboard/jobs/founder/workspace/JobWorkspace.tsx`
