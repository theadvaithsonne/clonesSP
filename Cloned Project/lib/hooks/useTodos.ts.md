# `lib/hooks/useTodos.ts`

> React hook providing CRUD for the current user's to-do items in the selected organisation via the backend `/todos` API.

**Kind:** React hook · **Lines:** 149

## Purpose
Backs the dashboard's to-do menu. It loads the user's todos for the org stored in `localStorage` (`garage_org_id`) and exposes add, assign-to-someone-else, edit and delete actions that keep the local list in sync with the server.

## How it works
- On mount, `fetchTodos()` runs: reads `garage_org_id`, sets `error = "No organization selected"` if absent, otherwise `GET /todos?orgId=...` and stores `response.todos` (newest first, as sorted by the server).
- `addTodo(task, targetUserId?)` - `POST /todos?orgId=...` with `{ task, targetUserId }`; prepends the returned todo to the local list.
- `addTodoForUser(task, targetUserId)` - same request but does **not** touch the local list (the new item belongs to someone else, so it would not appear in my list).
- `updateTodo(id, task)` - `PATCH /todos/:id?orgId=...` with `{ task }`; replaces the item locally.
- `deleteTodo(id)` - `DELETE /todos/:id?orgId=...`; removes it locally.
- Every mutation clears `error` first, sets it on failure and rethrows so callers can react. When no org is selected they set the error and return `undefined` without throwing.
- Only `fetchTodos` toggles `loading`.

## Exports
- `useTodos()` - returns `{ todos, loading, error, addTodo, addTodoForUser, updateTodo, deleteTodo, refetch }` (`refetch` is `fetchTodos`).
- `interface Todo` - `{ _id, task, orgId, userId, createdBy: { _id, name, email }, isPersonal, createdAt, updatedAt }`.

## Interfaces
- **Backend endpoints called** (router `server/routes/todos.ts`, mounted at `/todos`, all `requireAuth`, all require `orgId` query else 400):
  - `GET /backend/todos?orgId=...` - todos where `userId` is me in that org, `createdBy` populated.
  - `POST /backend/todos?orgId=...` - body `{ task (1-500 chars), targetUserId? }`; owner is `targetUserId` or me; `isPersonal` is true only when no target. When assigning to another user the server sends a `todo_assigned` notification via `emitNotification`.
  - `PATCH /backend/todos/:id?orgId=...` - only the owner can edit; 404 otherwise.
  - `DELETE /backend/todos/:id?orgId=...` - owner or creator can delete; 404 otherwise.
- **Database (indirect):** `Todo` model (`server/models/todo.model.ts`, default collection `todos`).
- **Browser storage:** reads `localStorage["garage_org_id"]` on every call.

## Dependencies
- **Internal:** `lib/api.ts` - `api()` authenticated fetch wrapper.
- **Packages:** `react` - `useState`, `useEffect`, `useCallback`.

## Used by
- `components/dashboard/TodoMenu.tsx`

## Notes
- The `PATCH` response is not populated, so after `updateTodo` the replaced item's `createdBy` is a bare id rather than `{ _id, name, email }` until the next refetch.
- The org id is read at call time, not tracked as state, so switching orgs does not refetch automatically; call `refetch()`.
- `GET /todos/user/:userId` exists on the backend but is not used here.
