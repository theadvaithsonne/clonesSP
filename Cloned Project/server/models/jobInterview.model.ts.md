# `server/models/jobInterview.model.ts`

> Mongoose model for one interview round on a job application, including the slots offered and each interviewer's scorecard.

**Kind:** Mongoose model · **Lines:** 119

## Purpose
Part of the Garage Jobs hiring pipeline. When a founder schedules an interview for an applicant, a `JobInterview` document is created. The founder can either fix a time straight away (`scheduledAt` set, status `scheduled`) or offer up to six candidate slots (`slots` + `candidatePicks: true`), in which case the round sits in `awaiting_candidate` until the candidate picks one. After the round, interviewers submit structured scorecards that live on the same document.

## How it works
### Constants
- `INTERVIEW_STATUSES`: `awaiting_candidate`, `scheduled`, `completed`, `cancelled`.
- `INTERVIEW_MODES`: `video`, `in_person`, `phone`.
- `RECOMMENDATIONS`: `strong_no`, `no`, `yes`, `strong_yes`.

### Sub-schemas (no `_id`)
- `RatingSchema` - `criterion` (required, max 120), `score` (1-5, required), optional `note` (max 2000).
- `ScorecardSchema` - `interviewerId` (ref `User`, required), `ratings[]`, optional `recommendation`, `privateNote` (max 4000), `submittedAt`.

### Main schema `JobInterviewSchema`
| Field | Notes |
|---|---|
| `orgId`, `jobId`, `applicationId`, `candidateId` | Required refs to `Organization`, `JobPosting`, `JobApplication`, `User`. |
| `stageId` | The posting's pipeline stage id (string, default `""`). |
| `roundLabel` | Default `"Interview"`, max 120. |
| `interviewerIds` | Array of `User` refs. |
| `mode` | Enum `INTERVIEW_MODES`, default `video`. |
| `durationMin` | Default 45, 5-480. |
| `timezone` | Optional string. |
| `slots` | Offered times (`Date[]`). The "up to six" limit is enforced by the routes, not the schema. |
| `candidatePicks` | Default `false`. |
| `scheduledAt`, `meetingUrl`, `location` (max 300), `message` (max 4000) | Logistics. |
| `status` | Enum, default `scheduled`. |
| `scorecards` | Array of `ScorecardSchema`. |
| `createdBy` | Required `User` ref. |

Timestamps are on. Indexes:
- `{ applicationId: 1, createdAt: -1 }` - the rounds for one application.
- `{ orgId: 1, status: 1, scheduledAt: 1 }` - an org's upcoming interviews.
- `{ candidateId: 1, status: 1 }` - a candidate's interviews.

## Exports
- `JobInterview` - Mongoose model `"JobInterview"`.
- `IJobInterview`, `IScorecard`, `IScorecardRating` - interfaces.
- `INTERVIEW_STATUSES`, `InterviewStatus`, `INTERVIEW_MODES`, `RECOMMENDATIONS`, `Recommendation` - enums and their types.

## Interfaces
- **Database:** `JobInterview` (collection `jobinterviews`) - read/write.

## Dependencies
- **Packages:** `mongoose`.

## Used by
- `server/routes/jobsFounder.ts` (`/jobs/founder`) - scheduling, rescheduling, scorecards.
- `server/routes/jobsCandidate.ts` (`/jobs`) - candidate views their interviews and picks a slot.
- `server/utils/meetCode.ts` - `isScheduledInterviewMeet(code)` checks `JobInterview.exists({ meetingUrl: /[?&]code=<code>$/, status: "scheduled" })` to recognise a Garage meet code that belongs to a scheduled interview.

## Notes
- `privateNote` on a scorecard is meant for the hiring team only; the routes must make sure it never reaches the candidate.
- `meetingUrl` doubles as the link between an interview and a Garage meet room (matched by its `code=` query parameter).
