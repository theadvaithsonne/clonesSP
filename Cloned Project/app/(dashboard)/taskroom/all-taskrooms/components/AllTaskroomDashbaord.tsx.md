# `app/(dashboard)/taskroom/all-taskrooms/components/AllTaskroomDashbaord.tsx`

> The "My TaskRooms" dashboard: a paginated grid of the user's TaskRooms with search, create, edit, delete and a V1-to-V2 migration wizard, all backed by the external Taskroom API.

**Kind:** Next.js app-directory module (colocated) · **Lines:** 617

## Purpose
This is the landing view of `/taskroom/all-taskrooms` when no `taskroomId` query parameter is present. TaskRooms are a kanban-style task product whose data lives in a separate service at `https://uatapi.garage.app` (not part of this repo). This component reads the user's identity from the locally stored JWT, lists their rooms, and coordinates the create, edit, delete and migrate modals. (The file name's "Dashbaord" spelling is original.)

## How it works

### Identity and loading (L139-L194)
- On mount, and whenever `currentPage` or `activeTab` changes, it reads `localStorage["garage_tok"]`, decodes it with `jwtDecode`, and takes `orgId`, `userId` and `role` from the payload.
- If both `orgId` and `userId` exist it calls `fetchTaskRooms(orgId, userId, page, 30)`, which does `GET https://uatapi.garage.app/taskroom/v1/rooms/detail?orgId=&page=&size=&userId=` with a `Bearer` token. On success it stores `data.data` as the room list, and `metadata.totalPages` / `metadata.count` for pagination. On a non-OK response or an exception it clears the list and shows a toast.
- A separate effect (L126-L137) filters rooms by `searchQuery` against name and description. The search input that set `searchQuery` is commented out, so in practice the filter is a pass-through and global search is done by `SearchList` instead.

### Create (L196-L253)
`handleCreateTaskRoom` first validates the token with `GET /backend/auth/me` (`${NEXT_PUBLIC_API_URL}/auth/me`, served by `server/routes/auth.ts` behind `requireAuth`). If valid it calls `POST https://uatapi.garage.app/taskroom/v1/rooms` with the modal's `{ name, description, color, orgId, userId }`, refetches the current page, toasts success, and jumps to the last page if the current one was full. An invalid token gives a "please log in again" toast.

### Edit (L314-L341)
`handleEditTaskRoom` sends `PUT https://uatapi.garage.app/taskroom/v1/rooms/{_id}` with `{ name, description, color }`, refetches, and closes the modal.

### Delete (L343-L403)
`handleDeleteTaskRoom` validates the token via `/backend/auth/me` again, then `DELETE https://uatapi.garage.app/taskroom/v1/rooms/{_id}`. If the deleted room was the last on its page it steps back a page; otherwise it refetches. The follow-up chat cleanup (`removeMemberFromTaskroomChat`) is commented out.

### Chat linkage helpers (L78-L102, L256-L312)
- `removeMemberFromTaskroomChat(conversationId)` - `DELETE https://uatapi.garage.app/api/chat/conversations/{id}`. Defined but its only call is commented out.
- `createTaskroomChat(taskroomData)` - `POST https://uatapi.garage.app/api/chat/conversations/group`, then `handleEditTaskRoomForConversationId` writes the new conversation id back with `PUT .../rooms/{id}`. The call site in create is commented out, so this is currently dead code.

### Rendering (L425-L616)
- Header with **Migrate** (opens `MigrationWizardModal`) and **New TaskRoom** (opens `CreateTaskRoomModal`).
- `SearchList` centred under the header, given `query`, `setQuery`, `userId`, `orgId`.
- Eight `SkeletonCard`s while loading; then an empty-state message or a responsive grid of `TaskRoomCard`s (each wired to open the edit or delete modal).
- `EditTaskRoomModal` and `DeleteConfirmationModal` share `selectedTaskRoom` and `isSubmitting`.
- A footer pager (First, Previous, a window of up to three page numbers, Next, Last) appears when `totalPages > 1`.

## Exports
- `default TaskRoomsDashboard()` - the dashboard component.

## Interfaces
- **Backend endpoints called:** `GET /backend/auth/me` - token check before create and delete.
- **External services:** Taskroom API at `https://uatapi.garage.app/taskroom/v1/rooms` (`GET /detail`, `POST /`, `PUT /{id}`, `DELETE /{id}`); Garage chat API at `https://uatapi.garage.app/api/chat/conversations` (only in unused helpers).
- **Environment variables:** `NEXT_PUBLIC_API_URL` - base for `/auth/me`.
- **Browser storage / cookies:** reads `localStorage["garage_tok"]` (JWT; decoded client-side for `orgId`, `userId`, `role` and sent as the Bearer token).

## Dependencies
- **Internal:** `./SkeletonCard`, `./create-taskroom-modal`, `./edit-taskroom-modal`, `./delete-confirmation-modal`, `./migration-wizard-modal`, `./search-list`, `./taskroom-card` - the dashboard's subcomponents; `components/ui/button.tsx`, `components/ui/input.tsx` - shadcn controls.
- **Packages:** `jwt-decode` - read claims from the stored token; `sonner` - toasts; `lucide-react` - icons; `next` - `useRouter`; `react`; `js-cookie` (imported, unused).

## Used by
- `app/(dashboard)/taskroom/all-taskrooms/page.tsx` - rendered at `/taskroom/all-taskrooms` when there is no `taskroomId` query parameter.

## Notes
- The Taskroom base URLs are hard-coded to the UAT host, not taken from an env var.
- `jwtDecode` runs outside the `try` block, so a malformed token in localStorage throws during the effect.
- `activeTab` ("created" / "assigned") is still in state and in the effect dependencies, but its tab UI is commented out, so it is always "created".
- `handleTaskRoomClick`, `userRole`, `Cookies`, `Search`, `Input` and `router` are unused. Several `console.log` calls run on every render.
