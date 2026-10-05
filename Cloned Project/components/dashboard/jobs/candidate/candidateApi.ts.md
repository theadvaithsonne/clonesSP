# `components/dashboard/jobs/candidate/candidateApi.ts`

> Typed client for the candidate side of Garage Jobs (garagenew-backend routes/jobsCandidate.ts, mounted at /jobs).

**Kind:** React component · **Lines:** 143

<!-- docgen:auto -->

## Purpose
Typed client for the candidate side of Garage Jobs (garagenew-backend
routes/jobsCandidate.ts, mounted at /jobs). Failures keep the whole JSON
body (JobsApiError.data): applying answers 409 with the existing
applicationId, 410 when the job closed, and 422 with per-field errors.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `DiscoverQuery` | type |  | 67 |
| `discoverJobs` | function | `discoverJobs(params: DiscoverQuery)` | 82 |
| `getJobView` | function | `getJobView(jobId: string)` | 84 |
| `recordJobView` | function | `async recordJobView(jobId: string, source?: string): Promise<void>` — Count a job view for the office's analytics. | 87 |
| `getApply` | function | `getApply(jobId: string)` | 97 |
| `saveApplyDraft` | function | `saveApplyDraft(jobId: string, payload: ApplyBody)` | 101 |
| `submitApplication` | function | `submitApplication(jobId: string, payload: ApplyBody)` | 104 |
| `getMyApplications` | function | `getMyApplications()` | 112 |
| `withdrawApplication` | function | `withdrawApplication(id: string)` | 114 |
| `pickInterviewSlot` | function | `pickInterviewSlot(interviewId: string, slot: string)` | 117 |
| `respondToOffer` | function | `respondToOffer(offerId: string, accept: boolean, reason?: string)` | 123 |
| `getSavedJobs` | function | `getSavedJobs()` | 128 |
| `saveJob` | function | `saveJob(jobId: string)` | 129 |
| `unsaveJob` | function | `unsaveJob(jobId: string)` | 130 |
| `getAlerts` | function | `getAlerts()` | 132 |
| `createAlert` | function | `createAlert(payload: { name?: string; criteria: AlertCriteria; frequenc…)` | 134 |
| `updateAlert` | function | `updateAlert(id: string, patch: Partial<{ name: string; criteria: AlertCriteria; fre…)` | 137 |
| `deleteAlert` | function | `deleteAlert(id: string)` | 142 |

## Interfaces

- **Other fetch/api calls (target not statically resolvable):**
  - `GET ${base}${path}` (L27)

## Dependencies

- **Internal:**
  - `lib/api.ts` — `API_URL`
  - `lib/auth.ts` — `getToken`
  - `components/dashboard/jobs/api.ts` — `JobsApiError`
  - `components/dashboard/jobs/types.ts` — `Answer`, `(types only)`
  - `components/dashboard/jobs/candidate/candidateTypes.ts` — `AlertCriteria`, `AlertFrequency`, `ApplyResponse`, `ApplySource`, `DiscoverResponse`, `JobAlert`, `JobViewResponse`, `MyApplication`, … +2
- **Packages:** none

## Used by

- `components/dashboard/jobs/candidate/AlertModal.tsx`
- `components/dashboard/jobs/candidate/ApplyFlow.tsx`
- `components/dashboard/jobs/candidate/DiscoverPage.tsx`
- `components/dashboard/jobs/candidate/JobPage.tsx`
- `components/dashboard/jobs/candidate/MyApplicationsPage.tsx`
- `components/dashboard/jobs/candidate/SavedPage.tsx`
- `components/dashboard/jobs/candidate/boardNav.tsx`
