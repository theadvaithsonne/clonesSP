# `components/dashboard/jobs/types.ts`

> Shapes returned by the Garage Jobs API (garagenew-backend: routes/jobsFounder.ts and routes/jobsCandidate.ts).

**Kind:** React component · **Lines:** 692

<!-- docgen:auto -->

## Purpose
Shapes returned by the Garage Jobs API (garagenew-backend: routes/jobsFounder.ts
and routes/jobsCandidate.ts). Keep in step with the backend models.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `JobStatus` | type |  | 4 |
| `EmploymentType` | type |  | 5 |
| `WorkplaceType` | type |  | 6 |
| `StageCategory` | type |  | 7 |
| `TeamRole` | type |  | 8 |
| `ApplicationStatus` | type |  | 9 |
| `ApplicationSource` | type |  | 10 |
| `JobFieldType` | type |  | 18 |
| `ConditionOperator` | type |  | 51 |
| `FieldOption` | interface |  | 53 |
| `Knockout` | interface |  | 58 |
| `FieldCondition` | interface |  | 69 |
| `FormField` | interface |  | 77 |
| `FormPage` | interface |  | 98 |
| `AutoAction` | interface |  | 107 |
| `Stage` | interface |  | 116 |
| `TeamMember` | interface |  | 124 |
| `JobReward` | interface |  | 129 |
| `Job` | interface |  | 139 |
| `Person` | interface |  | 196 |
| `OrgInfo` | interface |  | 204 |
| `RewardSplitPreview` | interface |  | 214 |
| `JobStats` | interface |  | 221 |
| `JobDetailResponse` | interface |  | 229 |
| `PostingRow` | interface |  | 241 |
| `OverviewResponse` | interface |  | 267 |
| `PostingsResponse` | interface |  | 296 |
| `PipelineCard` | interface |  | 308 |
| `PipelineResponse` | interface |  | 324 |
| `ApplicationRow` | interface |  | 332 |
| `ApplicationsResponse` | interface |  | 350 |
| `AnswerFile` | interface |  | 362 |
| `Answer` | interface |  | 369 |
| `Application` | interface |  | 375 |
| `Scorecard` | interface |  | 420 |
| `Interview` | interface |  | 429 |
| `Offer` | interface |  | 451 |
| `RewardStatus` | type |  | 467 |
| `Reward` | interface |  | 476 |
| `ActivityItem` | interface |  | 492 |
| `CandidateProfileResponse` | interface |  | 501 |
| `PayoutRow` | interface |  | 531 |
| `PayoutsResponse` | interface |  | 548 |
| `PayoutDetailResponse` | interface |  | 560 |
| `TalentCandidate` | interface |  | 580 |
| `TalentPoolResponse` | interface |  | 599 |
| `AnalyticsResponse` | interface |  | 607 |
| `EmailTemplateKind` | type |  | 627 |
| `EmailTemplate` | interface |  | 635 |
| `JobsSettings` | interface |  | 643 |
| `SettingsResponse` | interface |  | 659 |
| `InterviewDetailResponse` | interface |  | 667 |
| `OfficeMember` | interface |  | 684 |

## Interfaces

None detected: no endpoints, events, data access or environment reads were found.

## Dependencies

- **Internal:** none
- **Packages:** none

## Used by

- `components/dashboard/jobs/api.ts`
- `components/dashboard/jobs/candidate/AlertModal.tsx`
- `components/dashboard/jobs/candidate/ApplyFlow.tsx`
- `components/dashboard/jobs/candidate/DiscoverPage.tsx`
- `components/dashboard/jobs/candidate/candidateApi.ts`
- `components/dashboard/jobs/candidate/candidateTypes.ts`
- `components/dashboard/jobs/candidate/shared.tsx`
- `components/dashboard/jobs/constants.ts`
- `components/dashboard/jobs/founder/ApplicationsPage.tsx`
- `components/dashboard/jobs/founder/OverviewPage.tsx`
- `components/dashboard/jobs/founder/PayoutsPage.tsx`
- `components/dashboard/jobs/founder/PostingsPage.tsx`
- `components/dashboard/jobs/founder/TalentPoolPage.tsx`
- `components/dashboard/jobs/founder/candidate/CandidateDrawer.tsx`
- `components/dashboard/jobs/founder/candidate/OfferDrawer.tsx`
- `components/dashboard/jobs/founder/candidate/ScheduleInterviewModal.tsx`
- `components/dashboard/jobs/founder/candidate/ScorecardPage.tsx`
- `components/dashboard/jobs/founder/settings/DefaultPipelineSection.tsx`
- `components/dashboard/jobs/founder/settings/EmailTemplatesSection.tsx`
- `components/dashboard/jobs/founder/settings/SettingsPage.tsx`
- `components/dashboard/jobs/founder/settings/shared.tsx`
- `components/dashboard/jobs/founder/wizard/JobPreviewModal.tsx`
- `components/dashboard/jobs/founder/wizard/JobWizard.tsx`
- `components/dashboard/jobs/founder/wizard/StepBasics.tsx`
- `components/dashboard/jobs/founder/wizard/StepDescription.tsx`
- _…and 10 more_
