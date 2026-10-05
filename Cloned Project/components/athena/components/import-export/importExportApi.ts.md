# `components/athena/components/import-export/importExportApi.ts`

> Client-side API layer for the Athena (project management) task Import / Export wizard: lists workspaces, spaces and rooms with pagination, loads a room's stages and custom fields, bulk-imports spreadsheet rows as tasks, and pulls a room's tasks for export.

**Kind:** API helper module (TypeScript, no JSX) · **Lines:** 359

## Purpose
The Import / Export dashboard lets a user pick a destination (workspace, then space, then room), upload a spreadsheet, map columns to task fields and import the rows as tasks, or export a room's tasks. Every network call that wizard makes lives here. All calls go to the external **Taskroom v2** service (not part of this repo), so this file has no `/backend` endpoints. It also turns a mapped spreadsheet row (`ImportTaskRow`) into the payload shape Taskroom's bulk endpoint expects.

## How it works

### Base URL and auth
- `TASKROOM_BASE` is `NEXT_PUBLIC_TASKROOM_URL`, defaulting to `https://uatapi.garage.app/taskroomv2/v2/`, with trailing slashes normalised to exactly one.
- `getToken()` reads the `garage_tok` key from `localStorage` (empty string during SSR). `authHeaders()` returns a JSON `Content-Type` plus `Authorization: Bearer <token>` when a token exists.
- Every fetcher treats `!res.ok` or a body with `status === false` as an error and throws `Error(json.message || "<fallback>")`.

### Paginated pickers (L21-L136)
- `fetchWorkspacesPage`, `fetchSpacesPage`, `fetchRoomsPage` each fetch one page (default size `TARGET_LIST_PAGE_SIZE` = 25) and return `{ data, metadata }`.
- `parseListMetadata` normalises the server `metadata` into `ListMetadata` (`totalPages` defaults to 1, `currentPage` to the requested page, `nextPage` to `null`). Its `dataLength` parameter is accepted but unused.
- `hasMorePages(metadata)` returns true when `nextPage` is set, or when `currentPage < totalPages`. The dashboard and `PaginatedSelectColumn` use it to decide whether to load more items on scroll.
- `dedupeById` removes items with a missing or repeated `_id`. The dashboard uses it when it appends a new page to an existing list.
- `fetchWorkspacesList`, `fetchSpacesList`, `fetchRoomsList` are `@deprecated` wrappers that fetch page 1 with size 100. Nothing in the import-export folder calls them.

### Room metadata (L138-L166)
- `fetchRoomStages(roomId)` returns the room's stages trimmed to `{ _id, name, stageType }`.
- `fetchRoomCustomFields(roomId)` reads the room record and returns its `customFields` array. It accepts the room either at `json.data.data` or at `json.data`, and returns `[]` when the field is missing.

### Building import payloads (L168-L212)
- `resolveStageId(stageName, stages)` matches the row's stage text to a stage name, ignoring case and surrounding spaces. A blank or unknown stage falls back to the **first** stage. With no stages it returns `""`.
- `buildTaskPayload(row, roomId, stages)`:
  - `title` is trimmed and cut to 500 characters; `description` is trimmed and cut to 5000 characters.
  - `priority` is normalised to `high` / `low` / `normal` with `normalizePriority`.
  - `startDate` / `dueDate` become epoch milliseconds with `parseDateToTimestamp`. That function understands Excel serial numbers, raw timestamps and date strings.
  - `tags` is the tags cell split on `,`, `;` or `|`. These are sent as tag *names*.
  - `assignedToIds` is always `[]`, so a mapped Assignees column is not imported.
  - `customFields` is included only when the row has at least one parsed custom-field value.

### Bulk import (L214-L303)
- `importTasksToRoom(roomId, rows, stages, onProgress?)` sends **one** `POST tasks/bulk` with `{ roomId, tasks }`. It does not fall back to per-row requests. `onProgress` is called only twice: with `(0, total)` before the request and with `(total, total)` after it.
- A non-OK response, or a body with `status === false` or `success === false`, throws using `message`, `error` or `Bulk import failed (<status>)`.
- `parseBulkUploadResult` tolerates several response shapes. It reads counts from `data.successful` / `data.successCount` / `json.successful`, and `failed` the same way. When there are no counts it uses the length of the `data` array, or failing that assumes every row succeeded. Per-row errors come from `data.failedTasks`, `data.errors` or `json.failedTasks`. If the counts add up to less than the total and nothing failed, it reports every row as successful.

### Export (L305-L358)
- `fetchRoomTasksForExport(roomId)` calls `rooms/detail/:roomId?page=1&size=50&cardSize=500`, which returns stages, each with `cardData`. It flattens the cards into `ExportTaskRow`s:
  - assignee names, falling back to email, are joined with commas;
  - tag names are joined with commas;
  - dates are formatted with `toLocaleDateString()`.
- The export reads at most 50 stages and 500 cards per stage. Anything beyond that is left out without a warning.

## Exports
- `TARGET_LIST_PAGE_SIZE` - `25`, the default page size for the pickers.
- `hasMorePages(metadata: ListMetadata | null): boolean` - whether another page can be loaded.
- `dedupeById<T extends { _id: string }>(items: T[]): T[]` - removes items with a missing or duplicate `_id`.
- `fetchWorkspacesPage(page = 1, size = 25)` - one page of the current user's workspaces.
- `fetchSpacesPage(workspaceId, page = 1, size = 25)` - one page of spaces in a workspace.
- `fetchRoomsPage(spaceId, page = 1, size = 25)` - one page of rooms in a space.
- `fetchWorkspacesList()`, `fetchSpacesList(workspaceId)`, `fetchRoomsList(spaceId)` - deprecated single-request versions (size 100).
- `fetchRoomStages(roomId): Promise<RoomStage[]>` - the room's stages.
- `fetchRoomCustomFields(roomId): Promise<RoomCustomFieldDef[]>` - the room's custom field definitions.
- `importTasksToRoom(roomId, rows, stages, onProgress?): Promise<UploadResult>` - bulk-creates tasks.
- `fetchRoomTasksForExport(roomId): Promise<ExportTaskRow[]>` - flattened task rows for an export file.
- Types: `WorkspaceOption`, `SpaceOption`, `RoomOption` (`_id` plus an optional name and parent id), `ListMetadata`, `ExportTaskRow` (title, description, stage, priority, startDate, dueDate, assignees, tags, all strings).

## Interfaces
- **External services:** Taskroom v2 API (`NEXT_PUBLIC_TASKROOM_URL`, default `https://uatapi.garage.app/taskroomv2/v2/`):
  - `GET workspaces/me?size&page` - workspaces for the picker
  - `GET spaces/me?workspaceId&page&size` - spaces for the picker
  - `GET rooms/me?spaceId&page&size` - rooms for the picker
  - `GET stages/room/:roomId` - the room's stages
  - `GET rooms/:roomId` - the room record, used for `customFields`
  - `POST tasks/bulk` - bulk task creation
  - `GET rooms/detail/:roomId?page=1&size=50&cardSize=500` - stages with their cards, for export
- **Environment variables:** `NEXT_PUBLIC_TASKROOM_URL` - Taskroom base URL.
- **Browser storage / cookies:** reads `localStorage["garage_tok"]` and sends it as the bearer token.

## Dependencies
- **Internal:**
  - `./types` - `ImportTaskRow`, `RoomStage`, `UploadResult`.
  - `./parseSpreadsheet` - `normalizePriority`, `parseDateToTimestamp`.
  - `./roomCustomFields` - the `RoomCustomFieldDef` type.
- **Packages:** none (uses the global `fetch`).

## Used by
- `components/athena/components/import-export/ImportExportDashboard.tsx` - the pickers, stage and custom-field loading, import and export.
- `components/athena/components/import-export/PaginatedSelectColumn.tsx` - `hasMorePages` and the `ListMetadata` type.

## Notes
- The token comes from `localStorage` (`garage_tok`), not from a cookie, so these calls fail in a context where that key is not set.
- In bulk imports, assignees are always dropped (`assignedToIds: []`), and an unknown stage name is put in the first stage without a warning.
- Export dates are formatted in the browser's locale, so an exported file may not re-import with the same dates in another locale.
