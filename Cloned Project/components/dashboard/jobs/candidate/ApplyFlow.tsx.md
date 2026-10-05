# `components/dashboard/jobs/candidate/ApplyFlow.tsx`

> B3 / B4 · Applying for a job.

**Kind:** React component · **Lines:** 513 · **Directive:** `"use client"`

<!-- docgen:auto -->

## Purpose
B3 / B4 · Applying for a job. One form page at a time with the office's own
questions, profile answers prefilled from Garage, autosave to a draft
("Save and finish later" resumes it), timed pages with a countdown, and
per-field errors from both this screen and the server. Submitting shows B4.

The countdown is a guide: the server does not enforce time limits, so the
page never locks — a required answer can always still be given.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Composition

**Renders:** `Button`×10 (components/dashboard/jobs/ui.tsx), `Card`×4 (components/dashboard/jobs/ui.tsx), `ErrorState`×2 (components/dashboard/jobs/ui.tsx), `Check`×2 (lucide-react), `OrgLogo`×2 (components/dashboard/jobs/ui.tsx), `AlertCircle` (lucide-react), `LoadingBlock` (components/dashboard/jobs/ui.tsx), `ArrowLeft` (lucide-react), `Loader2` (lucide-react), `Clock` (lucide-react), `Info` (lucide-react), `FormRenderer` (components/dashboard/jobs/shared/FormRenderer.tsx)

**Hooks used:** `useBoardNav` (components/dashboard/jobs/candidate/boardNav.tsx), `useBoardStore` (components/dashboard/jobs/candidate/boardNav.tsx), `useUploadThing` (lib/uploadthing.ts)

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `default (ApplyFlow)` | component | `ApplyFlow()` | 77 |

## Interfaces

- **Timers / queues:** `setTimeout` at L184, L234; `setInterval` at L207

## Dependencies

- **Internal:**
  - `lib/uploadthing.ts` — `useUploadThing`
  - `components/dashboard/jobs/api.ts` — `JobsApiError`
  - `components/dashboard/jobs/constants.ts` — `LAYOUT_TYPES`
  - `components/dashboard/jobs/shared/FormRenderer.tsx` — `FormRenderer (default)`, `fieldState`, `AnswerMap`
  - `components/dashboard/jobs/ui.tsx` — `Button`, `Card`, `ErrorState`, `GOLD`, `LoadingBlock`, `OrgLogo`, `errorMessage`, `formatDate`
  - `components/dashboard/jobs/types.ts` — `Answer`, `AnswerFile`, `FormField`, `FormPage`, `(types only)`
  - `components/dashboard/jobs/candidate/boardNav.tsx` — `BOARD_PAGES`, `referralFor`, `useBoardNav`, `useBoardStore`
  - `components/dashboard/jobs/candidate/candidateApi.ts` — `* as candidateApi`
  - `components/dashboard/jobs/candidate/candidateTypes.ts` — `ApplyResponse`, `JobViewResponse`, `(types only)`
  - `components/dashboard/jobs/candidate/shared.tsx` — `placeText`, `processLabel`
- **Packages:**
  - `react`
  - `lucide-react` — `AlertCircle`, `ArrowLeft`, `Check`, `Clock`, `Info`, `Loader2`
  - `sonner` — `toast`

## Used by

- `components/dashboard/jobs/candidate/CandidateJobsApp.tsx`
