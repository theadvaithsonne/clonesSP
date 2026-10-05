# `app/(dashboard)/taskroom/all-taskrooms/components/migration-wizard-modal.tsx`

> Three-step wizard that links a legacy (V1) TaskRoom to a space inside a Taskroom V2 workspace by calling the external Taskroom migration endpoint.

**Kind:** Next.js app-directory module (colocated) · **Lines:** 564

## Purpose
Taskroom has a newer "V2" model (workspaces containing spaces). This modal, opened from the **Migrate** button on the TaskRooms dashboard, lets a user pick one of their V1 rooms, a V2 workspace they own and a space in it, then asks the external service to migrate (assign) the room into that space. All data lives in the external Taskroom service, not in this repo.

## How it works

### API helpers (L22-L102)
All requests send `Authorization: Bearer <localStorage garage_tok>` (`getToken`).
- `fetchTaskRooms(orgId, userId, page, size)` - `GET https://uatapi.garage.app/taskroom/v1/rooms?orgId=&page=&size=1000&userId=` (the `size` argument is ignored; 1000 is hard-coded).
- `fetchWorkspaces()` - `GET {BASE_URL}workspaces/me?size=1000&owner=true`.
- `fetchSpacesByWorkspace(workspaceId)` - `GET {BASE_URL}spaces/me?workspaceId=&page=1&size=1000&owner=true`.
- `assignRoom({ roomId, workspaceId, spaceId, userId })` - `POST https://uatapi.garage.app/taskroom/v1/migerate` (the path's spelling is as in the code). Non-OK responses throw with the server's `message` when present.
- `BASE_URL` is `NEXT_PUBLIC_TASKROOM_URL`, falling back to `https://uatapi.garage.app/taskroomv2/v2/` (must end with a slash because paths are appended directly).

### Presentational helpers (L104-L225)
`Stepper` (three labelled steps "V1 Workspace", "V2 Workspace", "Space", with done/active styling), `ItemRow` (radio-style selectable row with optional sub-text and badge), `Loader`, `Empty`, `ErrorMsg` and `SummaryRow`. None are exported.

### Wizard flow (L229-L348)
- **Open:** when `isOpen` turns true, the JWT is decoded for `orgId` and `userId`, and the user's V1 rooms are loaded for step 1.
- **Step 1:** choose a room; **Next** runs `handleGoStep2`, which clears previous V2 choices and loads workspaces.
- **Step 2:** choose a workspace; **Next** runs `handleGoStep3`, which loads that workspace's spaces. **Back** returns to step 1 without refetching.
- **Step 3:** choose a space; a summary of the three selections appears. **Add** runs `handleAdd`, which calls `assignRoom` and, on success, sets `submitted`.
- Each step keeps its own loading and error state; fetch failures show an inline error and a `react-hot-toast` toast.
- **Success screen:** shows the three selections and a **Start over** button (`handleReset`) that clears every selection and returns to step 1.

## Exports
- `MigrationWizardModal({ isOpen, onClose })` - the wizard; returns `null` when closed.

## Interfaces
- **External services:** Taskroom V1 API (`https://uatapi.garage.app/taskroom/v1/rooms`, `/taskroom/v1/migerate`) and Taskroom V2 API (`workspaces/me`, `spaces/me` under `BASE_URL`).
- **Environment variables:** `NEXT_PUBLIC_TASKROOM_URL` - base URL of the Taskroom V2 API.
- **Browser storage / cookies:** reads `localStorage["garage_tok"]` for both the Bearer token and the `orgId` / `userId` claims.

## Dependencies
- **Packages:** `jwt-decode` - read claims; `react-hot-toast` - toasts (the rest of the dashboard uses `sonner`, so these toasts only appear if a `react-hot-toast` `<Toaster>` is mounted); `lucide-react` - `X` icon; `react`.

## Used by
- `app/(dashboard)/taskroom/all-taskrooms/components/AllTaskroomDashbaord.tsx` - opened by the **Migrate** button.

## Notes
- Closing and reopening the modal does not reset the step or selections (only **Start over** does), so a reopened wizard may resume mid-way or show the success screen again.
- The UI calls a V1 room a "V1 Workspace" in labels.
