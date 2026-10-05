# `server/routes/jobsFounder.ts`

> src/routes/jobsFounder.ts

**Kind:** Express router · **Lines:** 2398 · **Mounted at:** `/jobs/founder` (browser: `/backend/jobs/founder`)

<!-- docgen:auto -->

## Purpose
src/routes/jobsFounder.ts

Founder API for Garage Jobs, mounted at /jobs/founder.

Every route runs requireAuth + `manager`, which resolves the office from the
caller's token and checks founder access against their membership record —
an org id sent by the client is never trusted. Guards are attached per route
(not router.use) because this router shares the /jobs prefix with the
candidate router.

Money never moves here directly: publishing, hiring, closing and "left
early" call services/jobRewards.ts, which only uses the existing wallet and
Unilevel Plus functions.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Endpoints (45)

| Method | Router path | Browser path | Middleware | Handler | Line |
|---|---|---|---|---|---|
| GET | `/overview` | `/backend/jobs/founder/overview` | `guard` | inline | 379 |
| GET | `/postings` | `/backend/jobs/founder/postings` | `guard` | inline | 525 |
| POST | `/jobs` | `/backend/jobs/founder/jobs` | `guard` | inline | 601 |
| GET | `/jobs/:id` | `/backend/jobs/founder/jobs/:id` | `guard` | inline | 629 |
| PATCH | `/jobs/:id` | `/backend/jobs/founder/jobs/:id` | `guard` | inline | 653 |
| POST | `/jobs/:id/publish` | `/backend/jobs/founder/jobs/:id/publish` | `guard` | inline | 723 |
| POST | `/jobs/:id/pause` | `/backend/jobs/founder/jobs/:id/pause` | `guard` | inline | 768 |
| POST | `/jobs/:id/resume` | `/backend/jobs/founder/jobs/:id/resume` | `guard` | inline | 777 |
| POST | `/jobs/:id/close` | `/backend/jobs/founder/jobs/:id/close` | `guard` | inline | 790 |
| POST | `/jobs/:id/duplicate` | `/backend/jobs/founder/jobs/:id/duplicate` | `guard` | inline | 801 |
| DELETE | `/jobs/:id` | `/backend/jobs/founder/jobs/:id` | `guard` | inline | 847 |
| GET | `/jobs/:id/pipeline` | `/backend/jobs/founder/jobs/:id/pipeline` | `guard` | inline | 949 |
| GET | `/applications/export` | `/backend/jobs/founder/applications/export` | `guard` | inline | 1093 |
| GET | `/applications` | `/backend/jobs/founder/applications` | `guard` | inline | 1128 |
| POST | `/applications/bulk` | `/backend/jobs/founder/applications/bulk` | `guard` | inline | 1171 |
| GET | `/applications/:appId` | `/backend/jobs/founder/applications/:appId` | `guard` | inline | 1272 |
| PATCH | `/applications/:appId` | `/backend/jobs/founder/applications/:appId` | `guard` | inline | 1343 |
| POST | `/applications/:appId/move` | `/backend/jobs/founder/applications/:appId/move` | `guard` | inline | 1358 |
| POST | `/applications/:appId/reject` | `/backend/jobs/founder/applications/:appId/reject` | `guard` | inline | 1390 |
| POST | `/applications/:appId/restore` | `/backend/jobs/founder/applications/:appId/restore` | `guard` | inline | 1408 |
| POST | `/applications/:appId/notes` | `/backend/jobs/founder/applications/:appId/notes` | `guard` | inline | 1420 |
| POST | `/applications/:appId/interviews` | `/backend/jobs/founder/applications/:appId/interviews` | `guard` | inline | 1460 |
| GET | `/interviews/:id` | `/backend/jobs/founder/interviews/:id` | `guard` | inline | 1585 |
| PATCH | `/interviews/:id` | `/backend/jobs/founder/interviews/:id` | `guard` | inline | 1644 |
| POST | `/interviews/:id/scorecard` | `/backend/jobs/founder/interviews/:id/scorecard` | `guard` | inline | 1670 |
| POST | `/applications/:appId/offers` | `/backend/jobs/founder/applications/:appId/offers` | `guard` | inline | 1729 |
| PATCH | `/offers/:id` | `/backend/jobs/founder/offers/:id` | `guard` | inline | 1795 |
| POST | `/applications/:appId/hire` | `/backend/jobs/founder/applications/:appId/hire` | `guard` | inline | 1810 |
| POST | `/applications/:appId/joining-date` | `/backend/jobs/founder/applications/:appId/joining-date` | `guard` | inline | 1851 |
| GET | `/payouts` | `/backend/jobs/founder/payouts` | `guard` | inline | 1867 |
| GET | `/payouts/:id` | `/backend/jobs/founder/payouts/:id` | `guard` | inline | 1938 |
| POST | `/payouts/:id/left-early` | `/backend/jobs/founder/payouts/:id/left-early` | `guard` | inline | 1963 |
| GET | `/talent-pool` | `/backend/jobs/founder/talent-pool` | `guard` | inline | 1986 |
| POST | `/talent-pool/invite` | `/backend/jobs/founder/talent-pool/invite` | `guard` | inline | 2060 |
| GET | `/jobs/:id/analytics` | `/backend/jobs/founder/jobs/:id/analytics` | `guard` | inline | 2094 |
| GET | `/settings` | `/backend/jobs/founder/settings` | `guard` | inline | 2195 |
| PUT | `/settings/careers-page` | `/backend/jobs/founder/settings/careers-page` | `guard` | inline | 2207 |
| PUT | `/settings/email-templates` | `/backend/jobs/founder/settings/email-templates` | `guard` | inline | 2235 |
| PUT | `/settings/rejection-reasons` | `/backend/jobs/founder/settings/rejection-reasons` | `guard` | inline | 2261 |
| POST | `/settings/saved-forms` | `/backend/jobs/founder/settings/saved-forms` | `guard` | inline | 2275 |
| DELETE | `/settings/saved-forms/:formId` | `/backend/jobs/founder/settings/saved-forms/:formId` | `guard` | inline | 2286 |
| PUT | `/settings/default-pipeline` | `/backend/jobs/founder/settings/default-pipeline` | `guard` | inline | 2295 |
| PUT | `/settings/privacy` | `/backend/jobs/founder/settings/privacy` | `guard` | inline | 2315 |
| GET | `/reward-preview` | `/backend/jobs/founder/reward-preview` | `guard` | inline | 2335 |
| POST | `/ai/description` | `/backend/jobs/founder/ai/description` | `guard` | inline | 2342 |

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `default (router)` | default |  | 2397 |

## Interfaces

- **Database (Mongoose models used):**
  - `JobPosting` (server/models/jobPosting.model.ts) — reads: `findOne`, `find`, `aggregate`, `countDocuments`, `distinct`, `findById`; **writes:** `create`, `findOneAndUpdate`, `findByIdAndUpdate`, `deleteOne`, `updateOne`
  - `JobApplication` (server/models/jobApplication.model.ts) — reads: `findOne`, `aggregate`, `countDocuments`, `find`, `exists`, `distinct`, `findById`; **writes:** `updateMany`, `updateOne`
  - `User` (server/models/user.model.ts) — reads: `find`, `findById`
  - `Organization` (server/models/organization.model.ts) — reads: `findById`
  - `STAGE_CATEGORIES` (server/models/jobPosting.model.ts) — referenced
  - `JobReward` (server/models/jobReward.model.ts) — reads: `aggregate`, `find`, `findOne`
  - `JobInterview` (server/models/jobInterview.model.ts) — reads: `find`, `findOne`; **writes:** `updateMany`, `create`
  - `JobOffer` (server/models/jobOffer.model.ts) — reads: `find`, `findOne`; **writes:** `updateMany`, `create`
  - `JobActivity` (server/models/jobActivity.model.ts) — reads: `find`
  - `JobEvent` (server/models/jobEvent.model.ts) — reads: `aggregate`
- **Environment via `server/config/env.ts`:** `env.OPENAI_API_KEY`

## Dependencies

- **Internal:**
  - `server/middleware/auth.ts` — `requireAuth`, `AuthUser`
  - `server/config/env.ts` — `env`
  - `server/models/organization.model.ts` — `Organization`
  - `server/models/user.model.ts` — `User`
  - `server/models/jobPosting.model.ts` — `JobPosting`, `IJobPosting`, `JOB_FIELD_TYPES`, `CONDITION_OPERATORS`, `STAGE_CATEGORIES`, `TEAM_ROLES`, `EMPLOYMENT_TYPES`, `WORKPLACE_TYPES`, … +3
  - `server/models/jobApplication.model.ts` — `JobApplication`, `IJobApplication`, `APPLICATION_SOURCES`
  - `server/models/jobActivity.model.ts` — `JobActivity`
  - `server/models/jobInterview.model.ts` — `JobInterview`, `INTERVIEW_MODES`, `RECOMMENDATIONS`
  - `server/models/jobOffer.model.ts` — `JobOffer`
  - `server/models/jobReward.model.ts` — `JobReward`
  - `server/models/jobEvent.model.ts` — `JobEvent`
  - `server/models/jobsSettings.model.ts` — `EMAIL_TEMPLATE_KINDS`
  - `server/services/jobs.ts` — `* as jobs`
  - `server/services/mailer.ts` — `sendMail`, `senderForOrg`
  - `server/services/jobRewards.ts` — `holdJobRewards`, `releaseJobHold`, `createRewardForHire`, `rescheduleReward`, `cancelRewardLeftEarly`, `rewardSplitPreview`, `paidRewardSplit`, `holdAmountFor`, … +1
- **Packages:**
  - `express` — `Router`, `Request`, `Response`, `NextFunction`
  - `zod` — `z`
  - `mongoose` — `Types`
  - `openai`

## Used by

- `server/app.ts`

Entry: mounted in `server/app.ts` at `/jobs/founder`.

## Notes

- Large file (2398 lines) — read it by section; line numbers above point into it.
