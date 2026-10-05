# `server/models/todo.model.ts`

> Mongoose model for workspace to-do items, either personal or assigned to another org member.

**Kind:** Mongoose model · **Lines:** 42

## Purpose
Backs the workspace task list (the frontend hook `lib/hooks/useTodos.ts`). A todo belongs to an organisation and to the user who should do it; `createdBy` records who made it, so a todo created by one member for another is an "assigned" task. When `server/routes/todos.ts` creates a todo for someone else it also sends a `todo_assigned` notification to the target user.

## How it works
Fields (timestamps on):
- `orgId` (-> `Organization`, required, indexed)
- `userId` (-> `User`, required, indexed) - the owner/assignee
- `task` (String, required, trimmed, max 500)
- `createdBy` (-> `User`, required, indexed)
- `isPersonal` (Boolean, default true, indexed) - the route sets it to `!targetUserId`, so it is false when the todo was created for another user; `GET /todos/user/:userId` lists only `isPersonal: false` todos

A compound index `{ orgId: 1, userId: 1 }` serves the main "my todos in this org" query.

## Exports
- `Todo` - Mongoose model `"Todo"` (collection `todos`).

## Interfaces
- **Database:** `Todo` (collection `todos`).

## Dependencies
- **Packages:** `mongoose` - `Schema`, `model` (`Types` is imported but unused).

## Used by
`server/routes/todos.ts` (mounted at `/todos`, browser `/backend/todos`: list, create, update, delete) and `server/services/memberCleanup.service.ts` (cleanup when a member is removed).
