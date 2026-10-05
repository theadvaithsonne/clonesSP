# `app/(dashboard)/taskroom/all-taskrooms/componentsSymbol/ai-copilot.tsx`

> The "AI Co-pilot" bar pinned to the bottom of a taskroom board, which uses an OpenAI-backed route to draft tasks, subtasks or workflow stages and then bulk-creates the ones the user selects on the external Taskroom API.

**Kind:** Next.js app-directory module (colocated) · **Lines:** 1252

## Purpose
Taskroom boards (under `/taskroom/all-taskrooms`) can be filled in by AI instead of by hand. This component renders a sticky footer bar ("AI Co-pilot · Active"). Expanding it shows three actions: **Generate Tasks**, **Generate Subtasks** and **Generate Stages**. Each opens a dialog with the same flow: describe what you want, review the AI's draft (with checkboxes and inline editing), then create the selected items in bulk. It is mounted once at the bottom of `kanban-board.tsx` and receives the board's column and task state so it can update the board straight away.

## How it works

### Props and state (L10-L78)
Props come from `KanbanBoard`: `columns`/`setColumns` (stages with their tasks), `stagecolumns`/`setStagecolumns` (the flat, paginated task list used by the list view), `taskRoomId`, `userId`, and the list-view paging controls `fetchListView(page)`, `hasMore`, `isFetching` and `nextPageToFetch`.
Local state is grouped per feature: generated items, selected indices (`Set<number>`, all selected by default), loading flags, the item being edited inline, and the step of the task dialog (`taskDialogStep`: `'input' | 'selection' | 'stage-selection'`).

### AI generation (all via `POST /api/taskroom/ai-chat`)
All three generators send `Authorization: Bearer <localStorage garage_tok>` and an OpenAI-style body (`model`, `temperature`, `max_tokens`, `response_format: json_object`, `messages`). The route reads `choices[0].message.content`, pulls out the first `{...}` block with a regex and `JSON.parse`s it. Failures show the toast "Failed to generate ... Please try again."
- **`generateStage`** (L213-L279): the system prompt asks for 5-10 sequential workflow stages ending with "Done". The response's `stageArray` becomes `{ name, description, color, type: "custom", orderId }`. Name and description are cut to 200 characters, and the colour is picked at random from the `stageColors` palette (L209).
- **`generateTasks`** (L467-L550): asks for 20-30 tasks in `{ tasks: [...] }`. The client keeps only title (200 chars), description (1,000 chars), priority (forced to low/medium/high, default medium) and tags. It always overrides `assignedToId: ''`, `startDate: now`, `dueDate: today 23:59:59.999`, `stageId: columns[0]._id` and `attachments: []`, whatever the model returned. It then moves to the `selection` step.
- **`generateSubtask`** (L402-L462): asks for `{ subTaskDetailArray: [{ subTaskDetail }] }` and shows the selection list.

### Review and edit
Each list has select/deselect toggles, a "Clear All" button and pencil-icon inline editors (`startEditing*` / `saveEditing*`, L571-L609): stage name and description; task title, priority and description; subtask text. "Regenerate" goes back to the input step without clearing the prompt.

### Bulk creation (external Taskroom API)
- **Tasks** (`handleCreateSelectedTasks` -> `createBulkTasks`, L103-L135, L321-L347): after picking tasks, the user picks a target stage in a third step. Every selected task gets `stageId = selectedTargetStageId`. `POST https://uatapi.garage.app/taskroom/v1/tasks/bulk` with `{ taskArray, roomId, userId }`. On `status: true` the returned tasks are appended to that column's `tasks` and `paginatedTaskRecords`, `taskCount` goes up, the tasks are also appended to `stagecolumns`, and the bar collapses.
- **Subtasks** (`handleCreateSelectedSubtasks` -> `createBulkSubTask`, L137-L160): `POST .../taskroom/v1/sub_tasks/bulk` with `{ subTaskDetailArray, roomId, taskId: selectedTasks, userId }`. Only a toast follows; board state is not changed.
- **Stages** (`handleInitCreateStages` -> confirm dialog -> `handleCreateSelectedStages(isReplace)` -> `createBulkStage`, L163-L207): a "Confirm Stage Creation" dialog asks whether to replace the existing stages. `POST .../taskroom/v1/stages/bulk` with `{ stageArray, roomId, userId, isReplace }`. On success, `columns` becomes the stages returned in `data.data.data`, each with empty `tasks` and `paginatedTaskRecords`. When `isReplace` is false, the existing columns are appended after the new ones (`columns.slice(0, -1)` plus the last column, so all of them).

### Subtask task picker
The subtask dialog lists `stagecolumns` (the paginated flat task list) as checkboxes inside a scroll container. A scroll listener (L81-L100, only active while that dialog is open) calls `fetchListView(nextPageToFetch)` within 100 px of the bottom, and there is also a "Load More" button while `hasMore` is true.

### Layout (L612-L1251)
The sticky bar and its expanded panel (three action cards plus a tips box), then four `Dialog`s: tasks, subtasks, stages and the replace confirmation.

## Exports
- `AICopilot(props: AicopilotProps)` - the co-pilot bar and its dialogs.

## Interfaces
- **Backend endpoints called:** `POST /api/taskroom/ai-chat` - a Next.js route handler in this repo (`app/api/taskroom/ai-chat/route.ts`). It checks the caller with `verifyTaskroomUser`, fixes the model to `gpt-4o-2024-11-20`, limits temperature, tokens and message count, and forwards the request to OpenAI with the server-side `OPENAI_API_KEY`. The `model` sent by this component is ignored there.
- **External services:** Taskroom API at `https://uatapi.garage.app/taskroom/v1/` - `POST tasks/bulk`, `POST sub_tasks/bulk`, `POST stages/bulk` (URLs hard-coded, no auth header sent); OpenAI (indirectly, through the route above).
- **Browser storage / cookies:** reads `localStorage.garage_tok` for the AI route's bearer token.

## Dependencies
- **Internal:** `../types/kanban` - `Task`, `Column` types; `components/ui/button`, `components/ui/dialog`.
- **Packages:** `react`; `lucide-react` - icons; `sonner` - toasts.

## Used by
- `app/(dashboard)/taskroom/all-taskrooms/componentsSymbol/kanban-board.tsx`, rendered at the bottom of every board on `/taskroom/all-taskrooms`.

## Notes
- **Subtask prompt bug:** `selectedTasks` holds a single task **id** (a string, not a list). `generateSubtask` sends that id as the user message, so the model is asked to break down an opaque ObjectId rather than the task's title or description. Subtask quality is therefore close to random.
- The subtask checkbox state uses `selectedTasks.includes(task._id)`, a substring check on a string. Clicking another task replaces the selection, so only one task can be chosen at a time, and the checkbox can never be unticked.
- `createBulkTasks`, `createBulkSubTask` and `createBulkStage` return `{ success: true }` even when the API answers `status: false`. Callers ignore the return value and clear the dialog state either way, so a failed create discards the user's selection.
- The bulk endpoints are called without an `Authorization` header and trust the `userId` in the body.
- `handleGenerateSubtasks` (L553-L569) is an unused placeholder with a fake 2-second delay, and `finalTasks` in `handleCreateSelectedTasks` is computed but never used.
- The prompts contain copy-paste leftovers (for example asking the stage generator for "5 to 10 realistic tasks" and "lowercase priority").
- Several `console.log` calls run on every render (`"1vcx43"`, `"stageArray"`, `"selectedTasks"`, `"stagecolumns"`).
