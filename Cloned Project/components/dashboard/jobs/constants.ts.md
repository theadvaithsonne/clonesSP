# `components/dashboard/jobs/constants.ts`

> Labels and small lookups shared by the Jobs screens.

**Kind:** React component · **Lines:** 315

<!-- docgen:auto -->

## Purpose
Labels and small lookups shared by the Jobs screens.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `JOB_PAGES` | const | `= { overview: "Founder:Jobs", postings: "Founder:Jobs:Postings", wizard: "Founder:Jobs:Ne…` | 15 |
| `STATUS_META` | const | `= { draft: { label: "Draft", bg: "rgba(161,161,170,0.12)", fg: "#a1a1aa" }, scheduled: { …` | 27 |
| `STAGE_CATEGORIES` | const | `= [ "applied", "screening", "assessment", "interview", "offer", "hired", ]` | 37 |
| `CATEGORY_META` | const | `= { applied: { label: "Applied", color: "#60a5fa" }, screening: { label: "Screening", col…` | 46 |
| `SOURCE_LABELS` | const | `= { garage_hq: "Garage HQ", university: "Garage University", public_link: "Public link", …` | 55 |
| `SOURCE_COLORS` | const | `= { referral: "var(--brand)", garage_hq: "#60a5fa", university: "#818cf8", public_link: "…` | 64 |
| `EMPLOYMENT_LABELS` | const | `= { full_time: "Full-time", part_time: "Part-time", contract: "Contract", internship: "In…` | 73 |
| `WORKPLACE_LABELS` | const | `= { hybrid: "Hybrid", remote: "Remote", onsite: "On-site", }` | 80 |
| `TEAM_ROLE_META` | const | `= { hiring_manager: { label: "Hiring manager", access: "Full access" }, recruiter: { labe…` | 86 |
| `CURRENCIES` | const | `= ["USD", "INR", "EUR", "GBP", "AED", "SGD", "AUD", "CAD"]` | 92 |
| `FIELD_GROUPS` | const | `= [ { title: "Basic", types: [ { type: "short_text", label: "Short text" }, { type: "long…` — The field library, grouped the way the builder's palette shows it. | 95 |
| `FIELD_LABELS` | const | `= Object.fromEntries( FIELD_GROUPS.flatMap((g) => g.types.map((t) => [t.type, t.label])) …` | 157 |
| `CHOICE_TYPES` | const | `= ["single_choice", "checkboxes", "dropdown", "ranking", "quiz_mcq"]` | 161 |
| `FILE_TYPES` | const | `= ["resume", "file_upload", "video_answer"]` | 162 |
| `LAYOUT_TYPES` | const | `= ["section_heading", "info_text"]` | 163 |
| `newId` | function | `newId(prefix = ""): string` | 165 |
| `makeField` | function | `makeField(type: JobFieldType): FormField` — A fresh field of `type` with sensible defaults for the builder. | 174 |
| `FORM_TEMPLATES` | const | `= [ { id: "simple", name: "Simple application", description: "Profile, resume and consent…` — Starter structures for the application form. | 218 |

## Interfaces

None detected: no endpoints, events, data access or environment reads were found.

## Dependencies

- **Internal:**
  - `components/dashboard/jobs/types.ts` — `ApplicationSource`, `EmploymentType`, `JobFieldType`, `JobStatus`, `StageCategory`, `TeamRole`, `WorkplaceType`, `FormField`, … +2
- **Packages:** none

## Used by

- `components/dashboard/jobs/candidate/AlertModal.tsx`
- `components/dashboard/jobs/candidate/ApplyFlow.tsx`
- `components/dashboard/jobs/candidate/DiscoverPage.tsx`
- `components/dashboard/jobs/candidate/shared.tsx`
- `components/dashboard/jobs/founder/ApplicationsPage.tsx`
- `components/dashboard/jobs/founder/FounderJobsApp.tsx`
- `components/dashboard/jobs/founder/OverviewPage.tsx`
- `components/dashboard/jobs/founder/PostingsPage.tsx`
- `components/dashboard/jobs/founder/candidate/CandidateDrawer.tsx`
- `components/dashboard/jobs/founder/candidate/OfferDrawer.tsx`
- `components/dashboard/jobs/founder/candidate/ScorecardPage.tsx`
- `components/dashboard/jobs/founder/settings/DefaultPipelineSection.tsx`
- `components/dashboard/jobs/founder/settings/EmailTemplatesSection.tsx`
- `components/dashboard/jobs/founder/settings/RejectionReasonsSection.tsx`
- `components/dashboard/jobs/founder/wizard/JobPreviewModal.tsx`
- `components/dashboard/jobs/founder/wizard/JobWizard.tsx`
- `components/dashboard/jobs/founder/wizard/StepBasics.tsx`
- `components/dashboard/jobs/founder/wizard/StepForm.tsx`
- `components/dashboard/jobs/founder/wizard/StepPipeline.tsx`
- `components/dashboard/jobs/founder/wizard/StepPublish.tsx`
- `components/dashboard/jobs/founder/workspace/AnalyticsTab.tsx`
- `components/dashboard/jobs/founder/workspace/CandidatesTab.tsx`
- `components/dashboard/jobs/founder/workspace/FormTab.tsx`
- `components/dashboard/jobs/founder/workspace/JobDetailsTab.tsx`
- `components/dashboard/jobs/founder/workspace/JobWorkspace.tsx`
- _…and 5 more_
