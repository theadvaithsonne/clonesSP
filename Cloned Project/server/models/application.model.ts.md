# `server/models/application.model.ts`

> Mongoose model `Application`: a job application submitted against an organisation's careers vacancy.

**Kind:** Mongoose model · **Lines:** 23

## Purpose
Stores applications from the public careers pages. An applicant (who need not be a Garage user) applies to a `Vacancy`, and the organisation reviews the application through a status pipeline.

## How it works
- `vacancyId` (ref `Vacancy`), `vacancyTitle` (denormalised), `orgId` (ref `Organization`) - required.
- `applicantName`, `applicantEmail` - required; `applicantPhone`, `resumeUrl`, `coverLetter` - optional.
- `status` - `pending` (default), `reviewed`, `shortlisted`, `rejected`, `hired`.
- Timestamps on; collection `applications`. No explicit indexes.

## Exports
- `Application` - Mongoose model.

## Interfaces
- **Database:** `Application` (collection `applications`).

## Dependencies
- **Packages:** `mongoose`.

## Used by
`server/routes/careers.ts`, mounted at `/careers` (browser `/backend/careers`): `POST /careers/applications` (no auth - public submission), `GET /careers/applications` and `PATCH /careers/applications/:id` (both `requireAuth`).

## Notes
- No index on `orgId` or `vacancyId`; listing applications for an org scans the collection.
