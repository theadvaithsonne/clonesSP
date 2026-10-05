# `server/services/jobs.ts`

> src/services/jobs.ts

**Kind:** backend service · **Lines:** 990

<!-- docgen:auto -->

## Purpose
src/services/jobs.ts

Rules shared by every Garage Jobs route: who may manage an office's hiring,
slugs, the default pipeline and application form, evaluating a submitted
form (conditional fields, validation, knockouts, quiz scoring), the match
score, the application activity log and candidate emails.

Money is NOT handled here — see services/jobRewards.ts, which only calls the
existing wallet and Unilevel Plus services.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `newId` | function | `newId(prefix = ""): string` | 42 |
| `STAGE_RANK` | const | `= STAGE_CATEGORIES.reduce( (acc, c, i) => ({ ...acc, [c]: i }), {} as Record<StageCategory, number>…` | 46 |
| `stripHtml` | function | `stripHtml(html: string \| undefined \| null): string` | 51 |
| `isObjectId` | function | `isObjectId(id: unknown): id is string` | 67 |
| `canManageJobs` | function | `async canManageJobs(userId: string, orgId: string): Promise<boolean>` — Founders (and stakeholders granted full access) manage an office's jobs. | 78 |
| `slugify` | function | `slugify(input: string): string` | 96 |
| `uniqueJobSlug` | function | `async uniqueJobSlug(orgId: string, title: string, excludeId?: string): Promise<string>` — A slug free within the office at the moment of the call. | 110 |
| `applicationReference` | function | `applicationReference(orgName: string): string` — "Northwind Labs" → "NW-APP-48213". | 131 |
| `builtInStages` | function | `builtInStages(): IJobStage[]` | 155 |
| `defaultStagesFor` | function | `defaultStagesFor(settings: IJobsSettings \| null): IJobStage[]` — The office's saved default pipeline, else the built-in six stages. | 165 |
| `consentLabel` | function | `consentLabel(orgName: string): string` | 196 |
| `defaultFormPages` | function | `defaultFormPages(orgName: string): IJobFormPage[]` — Every new posting starts with the essentials a founder would otherwise add by hand: profile fields, a resume and the consent declaration. | 205 |
| `readJobsSettings` | function | `async readJobsSettings(orgId: string): Promise<Pick<IJobsSettings, "careersPage" \| "priv…` — Settings for read-only paths (public pages, applying) — never writes. | 304 |
| `getJobsSettings` | function | `async getJobsSettings(orgId: string): Promise<IJobsSettings>` — The office's Jobs settings, created with sensible defaults on first read. | 313 |
| `stageById` | function | `stageById(job: Pick<IJobPosting, "stages">, id: string): IJobStage \| undefined` | 341 |
| `firstStage` | function | `firstStage(job: Pick<IJobPosting, "stages">): IJobStage \| undefined` | 345 |
| `nextStage` | function | `nextStage(job: Pick<IJobPosting, "stages">, currentId: string): IJobStage \| undefined` | 349 |
| `firstStageOfCategory` | function | `firstStageOfCategory(job: Pick<IJobPosting, "stages">, category: StageCategory): IJobStage \| undefined` | 354 |
| `PROFILE_FIELD_KEYS` | const | `= { profile_full_name: "fullName", profile_email: "email", profile_phone: "phone", profil…` | 363 |
| `allFields` | function | `allFields(job: Pick<IJobPosting, "form">): IJobFormField[]` | 379 |
| `answerableFieldCount` | function | `answerableFieldCount(job: Pick<IJobPosting, "form">): number` | 383 |
| `AnswerMap` | type |  | 387 |
| `toAnswerMap` | function | `toAnswerMap(answers: IJobAnswer[] \| undefined): AnswerMap` | 389 |
| `conditionMet` | function | `conditionMet(cond: IJobFieldCondition, answers: AnswerMap, fieldsById: Map<string, IJobFormField>): boolean` | 412 |
| `fieldState` | function | `fieldState(f: IJobFormField, answers: AnswerMap, fieldsById: Map<string, IJobFormField>): { visible: boolean; required: boolean }` — A conditional field is required only while its condition holds. | 444 |
| `validateAnswers` | function | `validateAnswers(job: Pick<IJobPosting, "form">, answers: AnswerMap, pageIndex?: number): Record<string, string>` — Field errors for one page (or every page when `pageIndex` is omitted). | 461 |
| `pruneHiddenAnswers` | function | `pruneHiddenAnswers(job: Pick<IJobPosting, "form">, answers: IJobAnswer[]): IJobAnswer[]` — Drop answers to fields that are hidden and set to clear when hidden. | 514 |
| `findKnockout` | function | `findKnockout(job: Pick<IJobPosting, "form">, answers: AnswerMap): { field: IJobFormField; reason?: string } \| null` — The first knockout rule the answers trip, if any. | 530 |
| `scoreQuiz` | function | `scoreQuiz(job: Pick<IJobPosting, "form">, answers: AnswerMap): { score: number; total: number; passed: boolean }…` | 550 |
| `profileFromAnswers` | function | `profileFromAnswers(job: Pick<IJobPosting, "form">, answers: AnswerMap): IJobApplication["profile"]` — Pull the typed profile snapshot out of the profile_* answers. | 577 |
| `computeMatch` | function | `computeMatch(job: Pick<IJobPosting, "skills" \| "experienceMin" \| "experi…, app: Pick<IJobApplication, "answers" \| "profile" \| "quiz">): { score: number; matchedSkills: string[] }` — A transparent 0–100 fit score from what the candidate submitted: skills — how many of the job's skills appear in their answers experience — years against the job's range location — remote roles always fit; otherwise a listed location match… | 601 |
| `logActivity` | function | `async logActivity(opts: { app: Pick<IJobApplication, "_id" \| "orgId" \| "jobId…): Promise<void>` | 653 |
| `frontendUrl` | function | `frontendUrl(path: string): string` | 683 |
| `publicJobUrl` | function | `publicJobUrl(orgSlugOrId: string, jobSlug: string): string` | 687 |
| `renderTemplate` | function | `renderTemplate(text: string, vars: Record<string, string>): string` | 693 |
| `sendCandidateEmail` | function | `async sendCandidateEmail(opts: { orgId: string; kind: EmailTemplateKind; to: string …): Promise<boolean>` — Send a candidate email from the office's template of that kind (or the explicit template id). | 712 |
| `notifyUsersByEmail` | function | `async notifyUsersByEmail(orgId: string, userIds: string[], subject: string, body: string): Promise<void>` — Plain notification to hiring-team members (knockouts, mentions). | 742 |
| `moveApplicationToStage` | function | `async moveApplicationToStage(app: IJobApplication, job: IJobPosting, stageId: string, actor?: { id?: string; name?: string }): Promise<void>` — Move an application to a stage, log it, and run what entering the stage triggers: the "moved to interview" email and the stage's on-enter actions. | 779 |
| `runOnEnterActions` | function | `async runOnEnterActions(app: Pick<IJobApplication, "profile">, job: IJobPosting, stage: IJobStage, vars: Record<string, string>): Promise<void>` | 810 |
| `rejectApplicationWithEmail` | function | `async rejectApplicationWithEmail(app: IJobApplication, job: IJobPosting, opts: { reason?: string; note?: string; actor?: { id?: stri…): Promise<void>` — Reject an application. | 841 |
| `createInterviewMeet` | function | `async createInterviewMeet(opts: { orgId: string; hostEmail: string; title: string; st…): Promise<string \| undefined>` — A Garage meeting for a video interview, created the same way POST /meet/create does (join code → LiveKit room → Meet row). | 892 |
| `cancelInterviewMeet` | function | `async cancelInterviewMeet(meetingUrl?: string): Promise<void>` — Kill a cancelled interview's meeting so its emailed link stops working. | 925 |
| `formatWhen` | function | `formatWhen(date: Date, timezone?: string): string` | 936 |
| `publishProblems` | function | `publishProblems(job: IJobPosting, now = new Date()): string[]` — What still blocks publishing — empty means ready. | 956 |

## Interfaces

- **Database (Mongoose models used):**
  - `STAGE_CATEGORIES` (server/models/jobPosting.model.ts) — referenced
  - `User` (server/models/user.model.ts) — reads: `findById`, `find`
  - `JobPosting` (server/models/jobPosting.model.ts) — reads: `findOne`
  - `JobsSettings` (server/models/jobsSettings.model.ts) — reads: `findOne`; **writes:** `create`
  - `JobActivity` (server/models/jobActivity.model.ts) — **writes:** `create`
  - `JobApplication` (server/models/jobApplication.model.ts) — **writes:** `updateOne`
- **Environment via `server/config/env.ts`:** `env.FRONTEND_URL`

## Dependencies

- **Internal:**
  - `server/models/jobPosting.model.ts` — `JobPosting`, `IJobPosting`, `IJobStage`, `IJobFormField`, `IJobFormPage`, `IJobFieldCondition`, `STAGE_CATEGORIES`, `StageCategory`
  - `server/models/jobApplication.model.ts` — `JobApplication`, `IJobApplication`, `IJobAnswer`
  - `server/models/jobActivity.model.ts` — `JobActivity`, `JobActivityType`
  - `server/models/jobsSettings.model.ts` — `JobsSettings`, `IJobsSettings`, `EmailTemplateKind`
  - `server/models/user.model.ts` — `User`
  - `server/utils/rbac.ts` — `findMembership`
  - `server/utils/accessCheck.ts` — `hasFounderAccess`
  - `server/services/mailer.ts` — `sendMail`, `senderForOrg`
  - `server/config/env.ts` — `env`
- **Packages:**
  - `crypto`
  - `mongoose` — `Types`

## Used by

- `server/routes/jobsCandidate.ts`
- `server/routes/jobsFounder.ts`
- `server/services/jobsSweeper.ts`
