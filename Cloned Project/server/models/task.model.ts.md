# `server/models/task.model.ts`

> Minimal Mongoose model for a simple org-scoped task (title, status, assignee, due date).

**Kind:** Mongoose model · **Lines:** 29

## Purpose
This model backs the basic org task list served by `server/routes/tasks.ts`. It is a lightweight kanban of `todo` / `inprogress` / `done` items for an organisation. It is separate from the personal `Todo` model and from the external Taskroom/Flowboard services.

## How it works
- Fields: `orgId` -> `Organization` (required, indexed); `title` (required, trimmed); `status` (enum `todo | inprogress | done`, default `todo`, indexed); `assignedTo` -> `User` (optional); `createdBy` -> `User` (required); `dueDate` (optional).
- `timestamps: true`. Default collection `tasks`.
- There are no compound indexes and no hooks.

## Exports
- `Task` - Mongoose model `"Task"`. No TypeScript interface is exported.

## Interfaces
- **Database:** `Task` (collection `tasks`) - read and written.

## Dependencies
- **Packages:** `mongoose`. `Types` is imported but not used.

## Used by
- `server/routes/tasks.ts`, mounted at `/tasks`. Browser paths are `GET/POST /backend/tasks` and `PATCH/DELETE /backend/tasks/:id`, all behind `requireAuth` and scoped to the caller's `orgId`.
- `server/services/memberCleanup.service.ts`. When a member is removed from an org, the service unassigns tasks assigned to them in that org (`updateMany` with `$unset: { assignedTo }`) and keeps the tasks they created. In the full-deletion path it deletes every task created by or assigned to the user (`deleteMany` with `$or`). That second query is **not** scoped to an org.
