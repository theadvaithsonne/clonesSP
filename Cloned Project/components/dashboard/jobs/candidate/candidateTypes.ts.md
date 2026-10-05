# `components/dashboard/jobs/candidate/candidateTypes.ts`

> Shapes returned by the candidate side of the Garage Jobs API (garagenew-backend routes/jobsCandidate.ts).

**Kind:** React component · **Lines:** 176

<!-- docgen:auto -->

## Purpose
Shapes returned by the candidate side of the Garage Jobs API
(garagenew-backend routes/jobsCandidate.ts). Candidates only ever see stage
categories and their own applications — never an office's hiring internals.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `PublicOrg` | interface |  | 15 |
| `PublicJob` | interface |  | 24 |
| `JobDescription` | interface |  | 51 |
| `JobDetail` | interface |  | 59 |
| `MyApplicationRef` | interface |  | 71 |
| `JobViewResponse` | interface |  | 79 |
| `DiscoverResponse` | interface |  | 87 |
| `ApplyResponse` | interface |  | 96 |
| `ApplySource` | type |  | 110 |
| `MyInterview` | interface |  | 112 |
| `MyApplication` | interface |  | 124 |
| `AlertCriteria` | interface |  | 152 |
| `AlertFrequency` | type |  | 162 |
| `JobAlert` | interface |  | 164 |

## Interfaces

None detected: no endpoints, events, data access or environment reads were found.

## Dependencies

- **Internal:**
  - `components/dashboard/jobs/types.ts` — `Answer`, `ApplicationStatus`, `EmploymentType`, `FormPage`, `JobStatus`, `StageCategory`, `WorkplaceType`, `(types only)`
- **Packages:** none

## Used by

- `components/dashboard/jobs/candidate/AlertModal.tsx`
- `components/dashboard/jobs/candidate/ApplyFlow.tsx`
- `components/dashboard/jobs/candidate/DiscoverPage.tsx`
- `components/dashboard/jobs/candidate/JobDetailView.tsx`
- `components/dashboard/jobs/candidate/JobPage.tsx`
- `components/dashboard/jobs/candidate/MyApplicationsPage.tsx`
- `components/dashboard/jobs/candidate/SavedPage.tsx`
- `components/dashboard/jobs/candidate/boardNav.tsx`
- `components/dashboard/jobs/candidate/candidateApi.ts`
- `components/dashboard/jobs/candidate/shared.tsx`
