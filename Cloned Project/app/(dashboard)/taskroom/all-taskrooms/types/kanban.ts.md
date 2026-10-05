# `app/(dashboard)/taskroom/all-taskrooms/types/kanban.ts`

> Shared TypeScript types for the Taskroom kanban board: tasks, subtasks, stages (columns), room members, employees and drag metadata.

**Kind:** Next.js app-directory module (colocated) · **Lines:** 94

## Purpose
The Taskroom feature (`/taskroom/all-taskrooms`) is a kanban board whose data lives in the external Taskroom API (`https://uatapi.garage.app/taskroom`). This file declares the client-side shapes for the objects that API returns, so every board component (columns, cards, dialogs, list/timeline/files views, search, side panel) agrees on field names. It contains types only; no runtime code.

## How it works
Almost every field is optional, because the API returns partial objects in different endpoints and the UI fills them in progressively.

- **`Task`** - a card. Mongo-style `_id` plus a legacy `id`, `title`, `description`, `priority` (`"high" | "medium" | "low"`), `tags`, `assignee`, `assignedToId`, `stageId`/`columnId` (the stage it belongs to), `roomId`, `userId`, `dueDate`/`startDate` (string or epoch number), `comments` (a count), `timeLoggedHours`, `attachments` (array of the private `media` shape: `fileLink`, `fileName`, `fileType`, `comment`), `isOverDue`, and `createdAt`/`updatedAt`/`lastModified`.
- **`Subtask`** - `_id`, `subTaskDetail`, `isCompleted`, `taskId`, and `assignedToIds` (a single id or an array).
- **`Member`** - a room-membership record; the inline comment says it is the userRole record returned by `POST /v1/users/roles` on the Taskroom API (`roomId`, `userId`, `role`, `status`, timestamps, `__v`).
- **`Column`** - a workflow stage: required `_id`, `name`, `color`, `tasks`, plus optional `taskCount` and `paginatedTaskRecords` (used when tasks are loaded page by page).
- **`DragItem`** - `id`, `type`, `columnId` for drag-and-drop.
- **`User`** - `id`, `name`, `avatar`, `color` (display user, e.g. for presence).
- **`Employee`** - org employee used for assignee pickers: `_id`, `id`, `name`, `firstName`, `email`, optional `lastName`, `avatar`, `color`, `departmentId`, `department` (`Department`), `organizationId`.
- **`DragEvent`** - who is dragging which task (`userId`, `userName`, `userColor`, `taskId`, `timestamp`); note it shadows the DOM `DragEvent` name inside files that import it.
- **`Department`** - `id`, `name`.

## Exports
- `Task` (interface) - a kanban task card.
- `Subtask` (interface) - a checklist item under a task.
- `Member` (interface) - a Taskroom room membership/role record.
- `Column` (interface) - a stage/column with its tasks.
- `DragItem` (interface) - drag payload.
- `User` (interface) - display user.
- `Employee` (interface) - org employee for assignment.
- `DragEvent` (interface) - collaborative drag notification.
- `Department` (interface) - department reference.

(`media` is declared but not exported.)

## Used by
`components/TaskroomSubPage.tsx`, and in `componentsSymbol/`: `ai-copilot.tsx`, `create-task-dialog.tsx`, `duplicatkancolum.tsx`, `edit-task-dialog.tsx`, `files-view.tsx`, `kanban-board.tsx`, `kanban-column.tsx`, `list-view.tsx`, `manage-stages-dialog.tsx`, `right-side-panel.tsx`, `task-card.tsx`, `task-search.tsx`, `timeline-view.tsx` (14 importers in total).

## Notes
- Exporting an interface named `DragEvent` can confuse readers in files that also handle native drag events; `manage-stages-dialog.tsx` avoids the clash by using `React.DragEvent`.
- The types describe an external service's payloads; they are not validated at runtime.
