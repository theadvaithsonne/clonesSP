# `server/models/jobPosting.model.ts`

> Mongoose model for a job posting, the core record of the Garage Jobs module. It holds everything the six-step "Post a job" wizard edits, from basics and description through the application form, pipeline, team and referral reward to publishing.

**Kind:** Mongoose model · **Lines:** 493

## Purpose
An office (organization) creates a `JobPosting` for every role it hires for. The application form, the hiring pipeline stages and the hiring team are **embedded** in the posting rather than stored in their own collections. The header comment gives two reasons: they are always read and written together with the posting, and a submitted application is judged against the form exactly as it stood, so there is no second source of truth to reconcile.

The model also installs the shared catalog hooks (`installCatalogHooks(JobPostingSchema, "job")`), so every save, update or delete queues a catalog-outbox entry. That outbox is what makes a job visible to EarnGPT and the opportunity matcher outside the Jobs module.

## How it works

### Enumerations (L16-L105, L174-L175)
| Constant | Values | Meaning |
|---|---|---|
| `JOB_STATUSES` | `draft`, `scheduled`, `live`, `paused`, `closed`, `filled`, `expired` | Lifecycle of a posting (default `draft`). |
| `EMPLOYMENT_TYPES` | `full_time`, `part_time`, `contract`, `internship` | |
| `WORKPLACE_TYPES` | `hybrid`, `remote`, `onsite` | |
| `STAGE_CATEGORIES` | `applied`, `screening`, `assessment`, `interview`, `offer`, `hired` | Every custom stage maps to one fixed category. Candidates only ever see the category (their progress bar), never the founder's stage names, and the cross-job overview funnel counts by category. |
| `TEAM_ROLES` | `hiring_manager`, `recruiter`, `interviewer` | |
| `JOB_FIELD_TYPES` | 31 types grouped as Basic (`short_text` ... `url`), Choice (`single_choice`, `checkboxes`, `dropdown`, `yes_no`, `rating`, `ranking`), Files (`resume`, `file_upload`, `portfolio_link`, `video_answer`), Assessment (`quiz_mcq`), Profile (`profile_full_name` ... `profile_linkedin`, prefilled from the candidate's Garage profile) and Layout (`section_heading`, `info_text`, `declaration`) | What the form builder can place on a page. |
| `CONDITION_OPERATORS` | `equals`, `not_equals`, `greater_than`, `less_than`, `contains` | For conditional fields. |
| `AUTO_ACTION_TRIGGERS` | `on_enter`, `quiz_score_gte`, `idle_days` | Stage automation triggers. |
| `AUTO_ACTION_KINDS` | `send_email`, `move_to_stage`, `remind_owner` | Stage automation actions. |

### Application form structure (L107-L172, L295-L359)
- **`IJobFormPage`** (`PageSchema`): `id`, `title`, optional `description`, optional `timeLimitMinutes` (timed section: the whole page must be answered within that time), optional `passMark` (number of correct quiz answers needed on the page), and `fields[]`.
- **`IJobFormField`** (`FieldSchema`):
  - `id` is the stable key that answers are stored against, so it must never change.
  - `type` (enum `JOB_FIELD_TYPES`), `label`, `helpText`, `required`, `locked` (locked fields, such as the consent declaration, cannot be removed or made optional).
  - `options[]` (`{ id, label }`) for choice fields.
  - Files: `fileTypes[]`, `maxSizeMb`, `multiple`, `parseResume`.
  - `scaleMax` (rating upper bound), `maxLength` (long-text limit).
  - Quiz: `correctOptionId`, `points`.
  - `talentPoolConsent` - a declaration that opts the candidate into the talent pool.
  - `knockout` (`KnockoutSchema`) - "if the answer is X, reject automatically", evaluated when a page is submitted: `enabled`, `answer` (option id, or `yes`/`no` for yes_no fields), `moveToRejected` (default true), `addReason` (default true), `reason`, `notifyTeam`, `emailTemplateId` (a rejection template from `JobsSettings`), `delayEmail` (default true).
  - `condition` (`ConditionSchema`) - "show only if `<fieldId> <operator> <value>`", with `hideUntilMet` and `clearIfHidden` (both default true).
- None of the sub-schemas have their own `_id`; they are identified by their string `id`.

### Pipeline and team (L177-L198, L361-L390)
- **`IJobStage`** (`StageSchema`): `id`, `name`, `category` (a `STAGE_CATEGORIES` value), optional `ownerId` (`User`), `autoActions[]`.
- **`IJobAutoAction`** (`AutoActionSchema`): `id`, `trigger`, `value` (quiz score for `quiz_score_gte`, days for `idle_days`), `action`, `targetStageId`, `emailTemplateId`.
- **`IJobTeamMember`** (`TeamMemberSchema`): `userId` plus a `role` from `TEAM_ROLES`.
- **`IJobCandidateEmails`**: toggles for `applicationReceived` (default true), `movedToInterview` (true), `rejection` (true), `rejectionDelayHours` (default 24, 0-168), `offer` (false).

### Referral reward (L208-L221, L445-L453)
`reward` configures the payout to whoever referred a successful hire:
- `enabled`, `amount` (USD per hire), `guaranteeDays` (schema enum `30 | 60 | 90`, default 90).
- `funding`: `"hold"` reserves `amount x openings` from the founder's GaragePay wallet when the job is published; `"on_hire"` charges per hire instead.
- `heldAmount` - what is still reserved; `totalHeld` - total ever reserved, for the payouts ledger; `payerId` - whose wallet funds the rewards (set at publish).

`server/services/jobRewards.ts` increments and decrements `reward.heldAmount` with atomic `findOneAndUpdate`/`updateOne` calls when it reserves, earmarks or releases funds.

### Main document `IJobPosting` / `JobPostingSchema` (L223-L293, L392-L477)
Grouped by wizard step:
1. **Basics** - `title` (max 160), `department`, `openings` (1-500, default 1), `employmentType` (default `full_time`), `workplace` (default `onsite`), `officeDays` (1-7), `locations[]`, `experienceMin`/`experienceMax` (0-60), `joining`, `salary { show (default true), currency (default USD), min, max, period: year|month|hour }`.
2. **Description** - `description { aboutRole, responsibilities, requirements, niceToHave, offer }`, `skills[]`, `education { required, qualification }`, `perks[]`.
3. **Form** - `form.pages[]`.
4. **Pipeline and team** - `stages[]`, `team[]`, `candidateEmails`.
5. **Reward** - `reward`.
6. **Publish** - `channels { garageHq (default true), university (false), publicLink (true) }`, `publishMode: now|scheduled`, `publishAt`, `closesAt`, `autoCloseOnHires` (default true).

Bookkeeping fields:
- `orgId`, `createdBy` (required refs), `status`, `slug` (required, unique within an org).
- `completedStep` (0-6) - highest wizard step the founder has finished.
- `stats { views, applyStarts }` - denormalised counters (raw events live in `JobEvent`).
- `publishedAt`, `closedAt`.
- `deletedAt` - deleting a posting that already has applicants only soft-hides it, so candidate records stay in the talent pool and keep pointing at a real job.

### Indexes (L479-L485)
- `{ orgId: 1, status: 1, updatedAt: -1 }` - an office's job list.
- `{ orgId: 1, slug: 1 }` **unique** - slug uniqueness per office.
- `{ status: 1, "channels.garageHq": 1, publishedAt: -1 }` - Discover: every live posting visible to Garage members, newest first.
- `{ status: 1, publishAt: 1 }` and `{ status: 1, closesAt: 1 }` - used by the sweeper for scheduled publishes and closing dates.

### Catalog hooks (L487-L490)
`installCatalogHooks` (from `_catalogHooks.ts`) adds post hooks on `save`, `findOneAndUpdate`, `findOneAndDelete` and document `deleteOne`. Each calls `enqueueCatalogChange("job", id, "upsert" | "delete")`. `updateOne`/`updateMany` are deliberately not hooked: those writes reach the catalog only through the hourly reconciler mentioned in `_catalogHooks.ts`.

## Exports
- `JobPosting` - Mongoose model `"JobPosting"`.
- Interfaces: `IJobPosting`, `IJobFormPage`, `IJobFormField`, `IJobFieldOption`, `IJobKnockout`, `IJobFieldCondition`, `IJobAutoAction`, `IJobStage`, `IJobTeamMember`, `IJobCandidateEmails`, `IJobReward`.
- Constants and types: `JOB_STATUSES`/`JobStatus`, `EMPLOYMENT_TYPES`/`EmploymentType`, `WORKPLACE_TYPES`/`WorkplaceType`, `STAGE_CATEGORIES`/`StageCategory`, `TEAM_ROLES`/`TeamRole`, `JOB_FIELD_TYPES`/`JobFieldType`, `CONDITION_OPERATORS`/`ConditionOperator`, `AUTO_ACTION_TRIGGERS`, `AUTO_ACTION_KINDS`.

## Interfaces
- **Database:** `JobPosting` (collection `jobpostings`) - read/write. Every save also writes a `CatalogOutbox` row via the hooks.
- **External services:** indirectly, the catalog outbox dispatcher (`catalogOutbox.dispatcher.ts`) signs these changes and POSTs them to NetworkChainApi.
- **Background work:** `server/services/jobsSweeper.ts` publishes scheduled postings and expires or closes them by `publishAt`/`closesAt`.

## Dependencies
- **Internal:** `server/models/_catalogHooks.ts` - `installCatalogHooks` for the catalog outbox.
- **Packages:** `mongoose`.

## Used by
- `server/routes/jobsFounder.ts` (`/jobs/founder`, browser `/backend/jobs/founder`) - the wizard, pipeline, analytics.
- `server/routes/jobsCandidate.ts` (`/jobs`) - Discover, job pages, applying.
- `server/routes/internal-catalog.ts` - serves job data to the catalog consumer.
- `server/services/jobs.ts`, `server/services/jobSearch.ts`, `server/services/jobRewards.ts`, `server/services/jobsSweeper.ts`.
- `server/models/jobAlert.model.ts`, `server/models/jobApplication.model.ts` - import its types/constants.
- `server/scripts/backfill-catalog-outbox.ts` - one-off backfill script (run by hand against the production database).

## Notes
- **Name clash:** this file exports an interface `IJobReward` describing the posting's reward *configuration*, while `server/models/jobReward.model.ts` exports a different `IJobReward` for the per-hire reward *record*. Import carefully.
- `reward.guaranteeDays` is restricted to 30/60/90 at schema level; any other value fails validation on save.
- Writes made with `updateOne`/`updateMany` (for example the sweeper's bulk status changes and `jobRewards.ts`'s held-amount updates) do not enqueue catalog changes immediately.
