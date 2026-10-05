# `server/models/teamforce/teamforceCandidate.model.ts`

> Mongoose model for a job applicant who applied to a Teamforce recruitment request. It holds the resume reference, custom-field answers and the applicant's hiring-pipeline stage.

**Kind:** Mongoose model · **Lines:** 75

## Purpose
When a recruitment request is "floated", candidates can apply. Signed-in users apply from inside the app; anyone can apply from the public job landing page `app/jobs/[id]`. Each application becomes a `TeamforceCandidate`. HR then moves it through the hiring pipeline (applied, reviewing, shortlisted, interview, offer, hired or rejected).

## How it works
- `CANDIDATE_STAGES`: `applied`, `reviewing`, `shortlisted`, `interview`, `offer`, `hired`, `rejected`. `CandidateStage` is the union type of these values.
- Embedded `CustomFieldValueSchema` (no `_id`) holds one answer per custom field published on the request: `fieldId`, `label`, `type` (`text`/`number`/`upload`), `value`, plus `fileKey`, `fileName`, `fileContentType` and `fileSize` for uploads.
- Main schema:
  - `orgId` and `recruitmentRequestId` (ref `TeamforceRecruitmentRequest`): both required and indexed.
  - Position snapshot: `positionName` (required), `department`, `jobLocation`. These are copied at application time so the pipeline stays readable even if the request is later edited or closed.
  - Applicant: `fullName`, `mobileNumber`, `email` (all required; `email` is lowercased and indexed), `yearsOfExperience` (required, min 0), `experienceDetails`, `currentCtc`, `expectedCtc`, `noticePeriod` (free-text strings).
  - Resume: `resumeKey` (S3 object key, required), `resumeFileName` (required), `resumeContentType`, `resumeSize`. Only the key is stored; the file itself lives in S3.
  - `customFieldValues`, `stage` (enum, default `applied`, indexed), `notes`, `isActive`. `timestamps: true`.
- Index: `{ orgId, recruitmentRequestId, createdAt: -1 }`, used for the per-request candidate list sorted newest first.

## Exports
- `CANDIDATE_STAGES` - the stage tuple. The candidates router uses it for stage filtering and zod validation.
- `CandidateStage` - the type of a single stage value.
- `TeamforceCandidate` - the Mongoose model `"TeamforceCandidate"` (collection `teamforcecandidates`).

## Interfaces
- **Database:** `TeamforceCandidate` (collection `teamforcecandidates`).
- **External services:** AWS S3 holds the resume and uploaded custom files, referenced by `resumeKey` and `customFieldValues[].fileKey`. The router serves them through `GET /backend/teamforce/candidates/:id/resume` and `.../:id/custom-file/:fieldId`.

## Dependencies
- **Packages:** `mongoose` - `Schema`, `model`, `Types`.

## Used by
- `server/routes/teamforce/candidates.ts`, mounted at `/teamforce/candidates`. Its endpoints:
  - `POST /backend/teamforce/candidates/:requestId/apply` (signed-in apply)
  - `POST /backend/teamforce/candidates/public/:requestId/apply` (unauthenticated apply from the public page)
  - `GET /backend/teamforce/candidates` (list)
  - `PATCH /backend/teamforce/candidates/:id` and `DELETE /backend/teamforce/candidates/:id`

## Notes
- Both apply routes accept applications only while the parent request has `status === "floated"` and `isActive`.
- There is no uniqueness constraint, so the same email can apply to the same request more than once.
