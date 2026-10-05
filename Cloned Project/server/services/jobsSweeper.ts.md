# `server/services/jobsSweeper.ts`

> src/services/jobsSweeper.ts

**Kind:** backend service · **Lines:** 268

<!-- docgen:auto -->

## Purpose
src/services/jobsSweeper.ts

Time-driven Garage Jobs work, run from index.ts every few minutes:
  • scheduled postings go live at their publish time
  • postings past their closing date expire and release any held rewards
  • delayed rejection emails go out
  • unanswered offers expire
  • stage owners hear about applications idle past a stage's "no action for
    N days" auto-action
  • job-alert digests (instant / daily / weekly) go to members
  • referral rewards whose guarantee ended are paid (services/jobRewards.ts)

Every step claims its rows with a conditional update before acting, so two
instances sweeping at once (local + production) cannot act twice, and every
step is isolated so one failing never stops the rest.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `sweepJobs` | function | `async sweepJobs(now = new Date()): Promise<void>` | 36 |

## Interfaces

- **Database (Mongoose models used):**
  - `JobOffer` (server/models/jobOffer.model.ts) — **writes:** `updateMany`
  - `JobPosting` (server/models/jobPosting.model.ts) — reads: `find`, `findById`, `countDocuments`; **writes:** `updateMany`, `updateOne`
  - `JobApplication` (server/models/jobApplication.model.ts) — reads: `find`; **writes:** `updateOne`
  - `Organization` (server/models/organization.model.ts) — reads: `findById`, `find`
  - `JobAlert` (server/models/jobAlert.model.ts) — reads: `find`; **writes:** `updateOne`
  - `User` (server/models/user.model.ts) — reads: `findById`

## Dependencies

- **Internal:**
  - `server/models/jobPosting.model.ts` — `JobPosting`
  - `server/models/jobApplication.model.ts` — `JobApplication`
  - `server/models/jobOffer.model.ts` — `JobOffer`
  - `server/models/jobAlert.model.ts` — `JobAlert`
  - `server/models/organization.model.ts` — `Organization`
  - `server/models/user.model.ts` — `User`
  - `server/services/jobRewards.ts` — `releaseJobHold`, `sweepJobRewards`
  - `server/services/jobs.ts` — `frontendUrl`, `notifyUsersByEmail`, `sendCandidateEmail`
  - `server/services/jobSearch.ts` — `buildJobSearchFilter`
  - `server/services/mailer.ts` — `EMAIL_FROM_NOTIFICATION`, `sendMail`
- **Packages:** none

## Used by

- `server/index.ts`
