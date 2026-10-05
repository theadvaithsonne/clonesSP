# `server/models/savedJob.model.ts`

> Mongoose model for a job posting a member bookmarked in Garage Jobs.

**Kind:** Mongoose model · **Lines:** 27

## Purpose
In Garage Jobs a member can save a posting from Discover. Each save is one row per (member, posting); saving the same job twice is a no-op.

## How it works
- Fields: `userId` (ref `User`), `jobId` (ref `JobPosting`), both required.
- Timestamps record only `createdAt` (`updatedAt: false`), since a bookmark never changes.
- Indexes: `{ userId, jobId }` unique (prevents duplicate saves) and `{ userId, createdAt: -1 }` (newest saved first).

## Exports
- `SavedJob` - model `"SavedJob"` (collection `savedjobs`).
- `ISavedJob` - document interface.

## Interfaces
- **Database:** `SavedJob` (collection `savedjobs`) - schema only.

## Dependencies
- **Packages:** `mongoose` - `Schema`, `model`.

## Used by
`server/routes/jobsCandidate.ts`, mounted at `/jobs` (browser: `/backend/jobs`): `GET /me/saved` lists up to 500 saved jobs, `POST /me/saved` creates one (ignoring duplicate-key error 11000, which is how "saving twice is a no-op" is implemented), `DELETE /me/saved/:jobId` removes it; job listings also look up which postings the caller has saved.
