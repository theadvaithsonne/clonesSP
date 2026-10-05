# `server/routes/jobsCandidate.ts`

> src/routes/jobsCandidate.ts

**Kind:** Express router · **Lines:** 949 · **Mounted at:** `/jobs` (browser: `/backend/jobs`)

<!-- docgen:auto -->

## Purpose
src/routes/jobsCandidate.ts

Candidate + public API for Garage Jobs, mounted at /jobs (after
/jobs/founder, so the founder router never falls through to these routes).

  /jobs/public/*   no login — careers pages, public job pages, view tracking
  /jobs/*          signed-in members — discover, apply, my applications

Candidates only ever see their own applications, and only the coarse stage
category — never the office's stage names, notes, scores or match score.
Guards are attached per route because this router shares the /jobs prefix.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Endpoints (19)

| Method | Router path | Browser path | Middleware | Handler | Line |
|---|---|---|---|---|---|
| GET | `/public/org/:orgSlug` | `/backend/jobs/public/org/:orgSlug` | — | inline | 142 |
| GET | `/public/job/:orgSlug/:jobSlug` | `/backend/jobs/public/job/:orgSlug/:jobSlug` | `softAuth` | inline | 167 |
| POST | `/public/job/:jobId/view` | `/backend/jobs/public/job/:jobId/view` | `softAuth` | inline | 192 |
| GET | `/discover` | `/backend/jobs/discover` | `requireAuth` | inline | 208 |
| GET | `/view/:jobId` | `/backend/jobs/view/:jobId` | `requireAuth` | inline | 251 |
| GET | `/apply/:jobId` | `/backend/jobs/apply/:jobId` | `requireAuth` | inline | 339 |
| PUT | `/apply/:jobId/draft` | `/backend/jobs/apply/:jobId/draft` | `requireAuth` | inline | 373 |
| POST | `/apply/:jobId/submit` | `/backend/jobs/apply/:jobId/submit` | `requireAuth` | inline | 418 |
| GET | `/me/applications` | `/backend/jobs/me/applications` | `requireAuth` | inline | 589 |
| POST | `/me/applications/:id/withdraw` | `/backend/jobs/me/applications/:id/withdraw` | `requireAuth` | inline | 673 |
| POST | `/me/interviews/:id/pick` | `/backend/jobs/me/interviews/:id/pick` | `requireAuth` | inline | 689 |
| POST | `/me/offers/:id/respond` | `/backend/jobs/me/offers/:id/respond` | `requireAuth` | inline | 741 |
| GET | `/me/saved` | `/backend/jobs/me/saved` | `requireAuth` | inline | 785 |
| POST | `/me/saved` | `/backend/jobs/me/saved` | `requireAuth` | inline | 817 |
| DELETE | `/me/saved/:jobId` | `/backend/jobs/me/saved/:jobId` | `requireAuth` | inline | 833 |
| GET | `/me/alerts` | `/backend/jobs/me/alerts` | `requireAuth` | inline | 874 |
| POST | `/me/alerts` | `/backend/jobs/me/alerts` | `requireAuth` | inline | 880 |
| PATCH | `/me/alerts/:id` | `/backend/jobs/me/alerts/:id` | `requireAuth` | inline | 908 |
| DELETE | `/me/alerts/:id` | `/backend/jobs/me/alerts/:id` | `requireAuth` | inline | 941 |

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `default (router)` | default |  | 948 |

## Interfaces

- **Database (Mongoose models used):**
  - `Organization` (server/models/organization.model.ts) — reads: `findOne`, `findById`, `find`
  - `JobApplication` (server/models/jobApplication.model.ts) — reads: `countDocuments`, `find`, `findOne`, `findById`; **writes:** `create`, `new + save`, `deleteOne`
  - `JobPosting` (server/models/jobPosting.model.ts) — reads: `find`, `findOne`, `countDocuments`, `distinct`, `findById`; **writes:** `updateOne`
  - `User` (server/models/user.model.ts) — reads: `findOne`, `findById`
  - `JobEvent` (server/models/jobEvent.model.ts) — **writes:** `create`
  - `SavedJob` (server/models/savedJob.model.ts) — reads: `find`; **writes:** `create`, `deleteOne`
  - `JobInterview` (server/models/jobInterview.model.ts) — reads: `find`, `findOne`; **writes:** `findOneAndUpdate`
  - `JobOffer` (server/models/jobOffer.model.ts) — reads: `find`, `findOne`
  - `JobAlert` (server/models/jobAlert.model.ts) — reads: `find`, `countDocuments`, `findOne`; **writes:** `create`, `deleteOne`

## Dependencies

- **Internal:**
  - `server/middleware/auth.ts` — `requireAuth`, `softAuth`, `AuthUser`
  - `server/models/organization.model.ts` — `Organization`
  - `server/models/user.model.ts` — `User`
  - `server/models/jobPosting.model.ts` — `JobPosting`, `IJobPosting`, `EMPLOYMENT_TYPES`, `WORKPLACE_TYPES`
  - `server/models/savedJob.model.ts` — `SavedJob`
  - `server/models/jobAlert.model.ts` — `JobAlert`, `ALERT_FREQUENCIES`
  - `server/models/jobApplication.model.ts` — `JobApplication`, `IJobAnswer`
  - `server/models/jobInterview.model.ts` — `JobInterview`
  - `server/models/jobOffer.model.ts` — `JobOffer`
  - `server/models/jobEvent.model.ts` — `JobEvent`
  - `server/services/jobs.ts` — `* as jobs`
  - `server/services/jobRewards.ts` — `rewardSplitPreview`
  - `server/services/affiliate.ts` — `setReferredByAffiliateId`
  - `server/services/jobSearch.ts` — `buildJobSearchFilter`, `criteriaFromQuery`, `normalizeCriteria`, `summarizeCriteria`, `LIVE_HQ_FILTER`
- **Packages:**
  - `express` — `Router`, `Request`, `Response`
  - `zod` — `z`
  - `mongoose` — `Types`

## Used by

- `server/app.ts`

Entry: mounted in `server/app.ts` at `/jobs`.
