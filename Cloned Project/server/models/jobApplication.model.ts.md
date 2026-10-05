# `server/models/jobApplication.model.ts`

> src/models/jobApplication.model.ts

**Kind:** Mongoose model · **Lines:** 251

<!-- docgen:auto -->

## Purpose
src/models/jobApplication.model.ts

One candidate's application to one JobPosting. A draft (the candidate saved
and left mid-form) is the same document with `isDraft: true`, so finishing it
later never creates a duplicate — `{ jobId, candidateId }` is unique.

`profile` is a snapshot of what the candidate submitted, not a live link to
their Garage profile: the hiring team must see what was actually sent.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Model `JobApplication`

- **Collection:** `jobapplications` (default pluralised name)
- **Schema options:** `timestamps: true`

| Field | Type | Flags |
|---|---|---|
| `jobId` | `Schema.Types.ObjectId` | required, ref "JobPosting" |
| `orgId` | `Schema.Types.ObjectId` | required, ref "Organization" |
| `candidateId` | `Schema.Types.ObjectId` | required, ref "User" |
| `reference` | `String` | required |
| `isDraft` | `Boolean` | default true |
| `furthestPage` | `Number` | default 0 |
| `stageId` | `String` | default "" |
| `stageCategory` | `String` | default "applied", enum STAGE_CATEGORIES |
| `maxStageRank` | `Number` | default 0 |
| `status` | `String` | default "active", enum APPLICATION_STATUSES |
| `answers` | `[AnswerSchema]` | default [] |
| `profile` | `{ fullName, title, email, phone, location, company, experienceYears, currentCtc, … }` | nested |
| `resume` | `FileSchema` | — |
| `source` | `String` | default "garage_hq", enum APPLICATION_SOURCES |
| `referral` | `new Schema( { referrerId: { type: Schema.Types.ObjectId, re…` | — |
| `matchScore` | `Number` | default 0 |
| `matchedSkills` | `[String]` | default [] |
| `quiz` | `new Schema( { score: Number, total: Number, passed: Boolean…` | — |
| `knockout` | `new Schema( { triggered: Boolean, fieldId: String, reason: …` | — |
| `rejection` | `new Schema( { reason: String, note: String, at: { type: Dat…` | — |
| `tags` | `[String]` | default [] |
| `starred` | `Boolean` | default false |
| `reviewedAt` | `Date` | — |
| `talentPoolConsent` | `Boolean` | default false |
| `consentUntil` | `Date` | — |
| `joiningDate` | `Date` | — |
| `hiredAt` | `Date` | — |
| `appliedAt` | `Date` | — |
| `stageEnteredAt` | `Date` | — |
| `lastActivityAt` | `Date` | default () => new Date() |
| `lastActivity` | `String` | — |
| `idleRemindedAt` | `Date` | — |

### Indexes

- `{ jobId: 1, candidateId: 1 }, { unique: true }` (L239)
- `{ orgId: 1, isDraft: 1, appliedAt: -1 }` (L240)
- `{ jobId: 1, isDraft: 1, stageId: 1 }` (L241)
- `{ candidateId: 1, updatedAt: -1 }` (L242)
- `{ orgId: 1, talentPoolConsent: 1 }` (L243)
- `{ "rejection.emailDueAt": 1 }, { sparse: true }` (L245)

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `APPLICATION_STATUSES` | const | `= ["active", "rejected", "withdrawn", "hired"] as const` | 13 |
| `ApplicationStatus` | type |  | 14 |
| `APPLICATION_SOURCES` | const | `= [ "garage_hq", "university", "public_link", "careers_page", "referral", "talent_pool", …` — Where the candidate came from — shown as "Source" across the founder views. | 17 |
| `ApplicationSource` | type |  | 25 |
| `IJobAnswerFile` | interface |  | 27 |
| `IJobAnswer` | interface |  | 34 |
| `IJobApplication` | interface |  | 41 |
| `JobApplication` | model | `model<IJobApplication>( "JobApplication", JobApplicationSchema )` | 247 |

## Interfaces

None detected: no endpoints, events, data access or environment reads were found.

## Dependencies

- **Internal:**
  - `server/models/jobPosting.model.ts` — `STAGE_CATEGORIES`, `StageCategory`
- **Packages:**
  - `mongoose` — `Schema`, `model`, `Document`, `Types`

## Used by

- `server/routes/jobsCandidate.ts`
- `server/routes/jobsFounder.ts`
- `server/services/jobRewards.ts`
- `server/services/jobs.ts`
- `server/services/jobsSweeper.ts`
