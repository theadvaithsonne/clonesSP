# `server/models/jobsSettings.model.ts`

> Mongoose model for per-office Garage Jobs settings: careers page, candidate email templates, rejection reasons, saved application forms, default pipeline and data-retention rules.

**Kind:** Mongoose model · **Lines:** 126

## Purpose
Each organization that uses Garage Jobs has at most one `JobsSettings` document (`orgId` is unique). It is created lazily the first time it is needed. Saved forms and the default pipeline reuse the job posting's page and stage shapes, but they are stored here as untyped `Mixed` arrays. The route-level zod schemas validate them, so the posting and settings definitions cannot drift apart.

## How it works
- `EMAIL_TEMPLATE_KINDS`: `application_received`, `moved_to_interview`, `interview_invite`, `rejection`, `offer`, `custom`.
- `TemplateSchema` (no `_id`): `id` (required), `name` (required, max 120), `kind` (default `custom`), `subject` (max 300), `body` (max 20,000).
- Main fields:
  - `orgId` - required, **unique**, ref `Organization`.
  - `careersPage` - `coverImage`, `headline` (max 200), `about` (max 4000), `culturePhotos[]`, `perks[]`, `showRewards` (default false).
  - `emailTemplates[]` - `TemplateSchema`. Job postings refer to these by `id` (for example knockout rejection emails and stage auto-actions).
  - `rejectionReasons[]` - `{ id, label }`.
  - `savedForms[]` - `{ id, name (max 120), pages: Mixed[], createdAt }`: reusable application forms.
  - `defaultPipeline.stages` - `Mixed[]`, the default hiring pipeline for new postings.
  - `privacy` - `retentionMonths` (default 12, 1-120), `allowDeletionRequests` (default true), `consentAddition` (extra consent text, max 4000).
- Timestamps on. No indexes beyond the unique `orgId`.

## Exports
- `JobsSettings` - Mongoose model `"JobsSettings"`.
- `IJobsSettings`, `IJobsEmailTemplate`, `IJobsSavedForm` - interfaces.
- `EMAIL_TEMPLATE_KINDS`, `EmailTemplateKind`.

## Interfaces
- **Database:** `JobsSettings` (collection `jobssettings`) - read/write.

## Dependencies
- **Packages:** `mongoose`.

## Used by
- `server/services/jobs.ts` - `readJobsSettings(orgId)` reads only `careersPage`/`privacy` for public pages and falls back to in-memory defaults without writing. `getJobsSettings(orgId)` is the lazy get-or-create: it seeds default email templates and rejection reasons, and on a duplicate-key error (two first reads racing on the unique `orgId`) re-reads the winner's document.
- `server/routes/jobsFounder.ts` (`/jobs/founder`) - the founder's settings screens.

## Notes
- Because `pages` and `stages` are `Mixed`, Mongoose does no validation or change tracking inside them. Whole-array assignment (or `markModified`) is needed when updating them through a document.
