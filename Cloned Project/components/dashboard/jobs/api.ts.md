# `components/dashboard/jobs/api.ts`

> Typed client for the Garage Jobs API (garagenew-backend /jobs/founder and /jobs).

**Kind:** React component · **Lines:** 382

<!-- docgen:auto -->

## Purpose
Typed client for the Garage Jobs API (garagenew-backend /jobs/founder and
/jobs). Nothing else in the app should hand-build these URLs.

Unlike `api()` in lib/api, failures keep the whole JSON body: publishing
answers 402 with the wallet balance, and submitting a form answers 422 with
per-field errors — the screens need those, not just the message.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `JobsApiError` | class | `extends Error` | 36 |
| `getOverview` | function | `getOverview(jobId?: string)` | 92 |
| `getPostings` | function | `getPostings(params: { status?: string; q?: string; department?: string;…)` | 94 |
| `createJob` | function | `createJob(title?: string)` | 106 |
| `getJob` | function | `getJob(id: string)` | 109 |
| `updateJob` | function | `updateJob(id: string, patch: Record<string, unknown>)` | 111 |
| `publishJob` | function | `publishJob(id: string)` | 117 |
| `pauseJob` | function | `pauseJob(id: string)` | 122 |
| `resumeJob` | function | `resumeJob(id: string)` | 123 |
| `closeJob` | function | `closeJob(id: string)` | 124 |
| `duplicateJob` | function | `duplicateJob(id: string)` | 126 |
| `deleteJob` | function | `deleteJob(id: string)` | 128 |
| `getPipeline` | function | `getPipeline(id: string, params: { q?: string; source?: string; minMatch?: number; t…)` | 130 |
| `getJobAnalytics` | function | `getJobAnalytics(id: string, days = 30)` | 135 |
| `getRewardPreview` | function | `getRewardPreview(amount: number)` | 138 |
| `generateDescription` | function | `generateDescription(payload: { title: string; department?: string; seniority?: …)` | 141 |
| `ApplicationQuery` | type |  | 160 |
| `getApplications` | function | `getApplications(params: ApplicationQuery)` | 175 |
| `downloadApplicationsCsv` | function | `async downloadApplicationsCsv(params: ApplicationQuery & { ids?: string[] })` — CSV of the filtered list (or of `ids`) — fetched with the auth header, saved as a file. | 179 |
| `bulkApplications` | function | `bulkApplications(payload: { ids: string[]; action: "move" \| "reject" \| "tag"…)` | 199 |
| `getCandidateProfile` | function | `getCandidateProfile(appId: string)` | 213 |
| `updateApplication` | function | `updateApplication(appId: string, patch: { tags?: string[]; starred?: boolean })` | 216 |
| `moveApplication` | function | `moveApplication(appId: string, payload: { stageId: string; note?: string; notifyTeam?: boo…)` | 222 |
| `rejectApplication` | function | `rejectApplication(appId: string, payload: { reason?: string; note?: string; sendEmail?: bool…)` | 228 |
| `restoreApplication` | function | `restoreApplication(appId: string)` | 234 |
| `addNote` | function | `addNote(appId: string, text: string, mentions: string[])` | 237 |
| `scheduleInterview` | function | `scheduleInterview(appId: string, payload: { stageId?: string; interviewerIds: string[]; mode…)` | 243 |
| `getInterview` | function | `getInterview(id: string)` | 262 |
| `updateInterview` | function | `updateInterview(id: string, patch: { status?: "cancelled" \| "completed"; scheduledAt?: …)` | 264 |
| `saveScorecard` | function | `saveScorecard(id: string, payload: { ratings: Array<{ criterion: string; score: numbe…)` | 267 |
| `createOffer` | function | `createOffer(appId: string, payload: { role: string; ctc: number; currency: string; joi…)` | 277 |
| `withdrawOffer` | function | `withdrawOffer(offerId: string)` | 290 |
| `hireApplication` | function | `hireApplication(appId: string, joiningDate: string)` | 293 |
| `updateJoiningDate` | function | `updateJoiningDate(appId: string, joiningDate: string)` | 299 |
| `getPayouts` | function | `getPayouts(status = "all")` | 307 |
| `getPayout` | function | `getPayout(id: string)` | 308 |
| `markLeftEarly` | function | `markLeftEarly(id: string, reason?: string)` | 309 |
| `getTalentPool` | function | `getTalentPool(params: { q?: string; tag?: string; minExp?: number; maxExp…)` | 312 |
| `inviteFromTalentPool` | function | `inviteFromTalentPool(candidateIds: string[], jobId: string)` | 321 |
| `SettingsSaveResponse` | type | Settings writes answer with the saved settings only (no office / URLs). | 330 |
| `getSettings` | function | `getSettings()` | 332 |
| `saveCareersPage` | function | `saveCareersPage(payload: { coverImage?: string \| null; headline?: string; a…)` | 334 |
| `saveEmailTemplates` | function | `saveEmailTemplates(templates: EmailTemplate[])` | 343 |
| `saveRejectionReasons` | function | `saveRejectionReasons(reasons: Array<{ id: string; label: string }>)` | 346 |
| `saveForm` | function | `saveForm(name: string, pages: FormPage[])` | 349 |
| `deleteSavedForm` | function | `deleteSavedForm(formId: string)` | 352 |
| `saveDefaultPipeline` | function | `saveDefaultPipeline(stages: Array<{ name: string; category: StageCategory; owne…)` | 355 |
| `savePrivacy` | function | `savePrivacy(payload: { retentionMonths: number; allowDeletionRequests: …)` | 358 |
| `getOfficeMembers` | function | `async getOfficeMembers(): Promise<OfficeMember[]>` — Office members — the only people who can join a hiring team. | 364 |
| `getGaragePayBalance` | function | `async getGaragePayBalance(): Promise<number>` — The founder's GaragePay (USD store wallet) balance for this office. | 372 |

## Interfaces

- **Other fetch/api calls (target not statically resolvable):**
  - `GET ${base}${path}` (L51)
  - `GET ${base}${F}/applications/export${qs({ ...rest, ids: ids?.join(",") })}` (L183)

## Dependencies

- **Internal:**
  - `lib/api.ts` — `API_URL`
  - `lib/auth.ts` — `getOrgId`, `getToken`
  - `components/dashboard/jobs/types.ts` — `AnalyticsResponse`, `ApplicationsResponse`, `CandidateProfileResponse`, `InterviewDetailResponse`, `Job`, `JobDetailResponse`, `OfficeMember`, `Offer`, … +16
- **Packages:** none

## Used by

- `components/dashboard/jobs/candidate/ApplyFlow.tsx`
- `components/dashboard/jobs/candidate/candidateApi.ts`
- `components/dashboard/jobs/founder/ApplicationsPage.tsx`
- `components/dashboard/jobs/founder/OverviewPage.tsx`
- `components/dashboard/jobs/founder/PayoutsPage.tsx`
- `components/dashboard/jobs/founder/PostingsPage.tsx`
- `components/dashboard/jobs/founder/TalentPoolPage.tsx`
- `components/dashboard/jobs/founder/candidate/CandidateDrawer.tsx`
- `components/dashboard/jobs/founder/candidate/HireModal.tsx`
- `components/dashboard/jobs/founder/candidate/OfferDrawer.tsx`
- `components/dashboard/jobs/founder/candidate/RejectModal.tsx`
- `components/dashboard/jobs/founder/candidate/ScheduleInterviewModal.tsx`
- `components/dashboard/jobs/founder/candidate/ScorecardPage.tsx`
- `components/dashboard/jobs/founder/settings/CareersPageSection.tsx`
- `components/dashboard/jobs/founder/settings/DefaultPipelineSection.tsx`
- `components/dashboard/jobs/founder/settings/EmailTemplatesSection.tsx`
- `components/dashboard/jobs/founder/settings/PrivacySection.tsx`
- `components/dashboard/jobs/founder/settings/RejectionReasonsSection.tsx`
- `components/dashboard/jobs/founder/settings/SavedFormsSection.tsx`
- `components/dashboard/jobs/founder/settings/SettingsPage.tsx`
- `components/dashboard/jobs/founder/wizard/JobWizard.tsx`
- `components/dashboard/jobs/founder/wizard/StepDescription.tsx`
- `components/dashboard/jobs/founder/wizard/StepForm.tsx`
- `components/dashboard/jobs/founder/wizard/StepPipeline.tsx`
- `components/dashboard/jobs/founder/wizard/StepPublish.tsx`
- _…and 5 more_
