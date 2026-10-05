# `components/dashboard/inlineApps/teamforce/sections/RecruitmentSection.tsx`

> React component `RecruitmentSection`.

**Kind:** React component · **Lines:** 3367 · **Directive:** `"use client"`

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Composition

**Renders:** `Field`×16 (local), `Loader2`×13 (lucide-react), `DetailCard`×11 (local), `ApplyField`×10 (local), `IconBtn`×9 (local), `ArrowLeft`×7 (lucide-react), `ApplyInput`×7 (local), `InfoRow`×7 (local), `SelectInput`×6 (local), `Eye`×4 (lucide-react), `TextArea`×4 (local), `DetailBlock`×4 (local), `PreviewBlock`×4 (local), `TextInput`×3 (local), `ViewActionBtn`×3 (local), `DetailGrid`×3 (local), `Upload`×3 (lucide-react), `Download`×3 (lucide-react), `RecruitmentForm`×2 (local), `JobApplicationForm`×2 (local), `XIcon`×2 (lucide-react), `Pencil`×2 (lucide-react), `CheckCircle2`×2 (lucide-react), `Pagination`×2 (local), `ShareJobModal`×2 (local), `Share2`×2 (lucide-react), `Briefcase`×2 (lucide-react), `Clock`×2 (lucide-react), `DollarSign`×2 (lucide-react), `RecruitmentView` (local), `ApplicationFormBuilder` (local), `CandidatePipelineView` (local), `CandidateApplicationView` (local), `JobLandingPreview` (local), `RecruitmentList` (local), `XCircle` (lucide-react), `Send` (lucide-react), `CircleX` (lucide-react), `NumberInput` (local), `DateInput` (local), … +21 more

**Hooks used:** `useState`×44, `useEffect`×15, `useRef`×11, `useCallback`×3, `useMemo`×3, `usePagination`×2 (local)

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `default (RecruitmentSection)` | component | `RecruitmentSection()` | 141 |

## Interfaces

- **Timers / queues:** `setTimeout` at L1168, L2306, L2308, L2597, L2818, …
- **External hosts mentioned in the code:** `wa.me`, `www.linkedin.com`, `twitter.com`

## Dependencies

- **Internal:**
  - `components/dashboard/inlineApps/teamforce/api.ts` — `listRecruitmentRequests`, `createRecruitmentRequest`, `updateRecruitmentRequest`, `listBranches`, `listDepartments`, `listEmployees`, `submitCandidateApplication`, `listCandidates`, … +6
  - `components/dashboard/inlineApps/teamforce/api.ts` — `CustomFieldSubmission`, `(types only)`
  - `components/dashboard/inlineApps/teamforce/types.ts` — `RecruitmentRequest`, `RecruitmentStatus`, `RecruitmentRequestPayload`, `Branch`, `Department`, `EmployeeListItem`, `EmploymentType`, `ExperienceRange`, … +6
- **Packages:**
  - `react` — `useCallback`, `useEffect`, `useMemo`, `useRef`, `useState`, `ReactNode`
  - `lucide-react` — `Plus`, `Loader2`, `Eye`, `Pencil`, `Send`, `CircleX`, …
  - `sonner` — `toast`

## Used by

- `components/dashboard/inlineApps/teamforce/TeamforceApp.tsx`

## Notes

- Large file (3367 lines) — read it by section; line numbers above point into it.
