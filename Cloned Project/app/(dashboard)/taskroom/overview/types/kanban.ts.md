# `app/(dashboard)/taskroom/overview/types/kanban.ts`

> TypeScript type definitions for Taskroom kanban data (tasks, stage columns, members, employees), used by the Taskroom overview page.

**Kind:** Next.js app-directory module (colocated) · **Lines:** 82

## Purpose
This file gives a shape to the JSON returned by the external Taskroom API (`https://uatapi.garage.app/taskroom`) and to some kanban UI concepts such as drag items and drag events. It contains only types and has no runtime code.

## Exports
- `Task` - a task. Every field is optional: `_id`/`id`, `title`, `description`, `priority` (`"high" | "medium" | "low"`), `tags`, `assignee`, `stageId`, `columnId`, `roomId`, `userId`, `assignedToId`, `dueDate`/`startDate` (typed as strings, though the API sends millisecond timestamps), `comments`, `lastModified`, `timeLoggedHours`, `createdAt`/`updatedAt`, `isOverDue`, `isCompleted`, `stageData` (the task's stage as a `Column`) and `taskCount`.
- `Member` - a room membership record. A comment says it is returned by `POST /v1/users/roles` on the Taskroom API. Fields: `_id`, `roomId`, `userId`, `role`, `status`, timestamps, `__v`.
- `Column` - a kanban stage: `_id`, `tasks: Task[]`, `color`, `name`, plus an optional `taskCount` (filled in by the stages endpoint).
- `DragItem` - a drag-and-drop payload: `id`, `type`, `columnId`.
- `User` - a display user: `id`, `name`, `avatar`, `color`.
- `Employee` - an assignable person: `_id`, `id`, `name`, `firstName`, `email`, plus optional `lastName`, `avatar`, `color`, `departmentId` and `department`.
- `DragEvent` - a "someone is dragging" presence event: `userId`, `userName`, `userColor`, `taskId`, `timestamp`. It shadows the DOM `DragEvent` name wherever it is imported.
- `Department` - `id`, `name`.

## Dependencies
- **Internal:** none
- **Packages:** none

## Used by
- `app/(dashboard)/taskroom/overview/page.tsx`. It imports most of these types but actually uses only `Task` and `Column`.

## Notes
- `Task.dueDate` is typed `string`, but the overview page treats it as a millisecond number in string form (`Number(task.dueDate)`). Read these types as loose descriptions, not a strict contract.
