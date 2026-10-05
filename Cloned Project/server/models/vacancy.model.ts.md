# `server/models/vacancy.model.ts`

> Mongoose model for job vacancies posted by an organisation on the legacy careers feature.

**Kind:** Mongoose model · **Lines:** 28

## Purpose
Stores job openings for the legacy `/careers` API. `server/app.ts` notes that the newer Garage Jobs founder hiring console is a separate feature; this model belongs only to the older careers routes.

## How it works
Fields (timestamps on):
- `orgId` (-> `Organization`, required)
- `title`, `department`, `location`, `description` (String, required)
- `employmentType` - `"full-time" | "part-time" | "contract" | "internship"`, default `"full-time"`
- `requirements`, `salary` (free-text strings, optional)
- `status` - `"open" | "closed" | "draft"`, default `"open"`
- `createdBy` (-> `User`)

No custom indexes beyond `_id`.

## Exports
- `Vacancy` - Mongoose model `"Vacancy"` (collection `vacancies`).

## Interfaces
- **Database:** `Vacancy` (collection `vacancies`).

## Dependencies
- **Packages:** `mongoose` - `Schema`, `model`, `Types`.

## Used by
`server/routes/careers.ts` only (mounted at `/careers`, browser `/backend/careers`), which lists, reads, creates, updates and deletes vacancies scoped by `orgId`.

## Notes
- Queries filter by `orgId` without an index on it; fine at small scale.
