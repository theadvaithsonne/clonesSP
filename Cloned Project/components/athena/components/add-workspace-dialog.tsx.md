# `components/athena/components/add-workspace-dialog.tsx`

> A two-step "New workspace" wizard dialog for Athena/Taskroom: pick a usage type, name the workspace, then create the workspace with a default space and room and select it in the URL.

**Kind:** React component · **Lines:** 182

## Purpose
Creating an Athena workspace is more than one API call: the Taskroom store's `createWorkspaceAndSpaceAndRooms` creates the workspace and then a default space and room so the user lands somewhere usable. This dialog is the UI front end for that flow, opened from the Athena workspace sidebar and the dashboard Taskroom view.

## How it works
- **Step 1:** choose `Work`, `Personal` or `School` (`USAGE_OPTIONS`, each with an icon and hint). Next is enabled once a type is chosen.
- **Step 2:** enter a workspace name (Finish enabled when non-blank). A progress bar shows step/total (2 steps).
- **Finish (`handleNext` on the last step):** calls `createWorkspaceAndSpaceAndRooms(usage || "Personal", workspaceName, router)` from `useTaskroomWorkspacetore`. In the store this does `POST {NEXT_PUBLIC_TASKROOM_URL}workspaces` (with default colour `#008080`), then `POST ... spaces` with a random space name/code, then a room. If the response has no truthy `status`, the dialog stays open (the store has already shown an error toast).
- On success it rewrites the query string: removes `spaceId`/`roomId`, then sets `workspaceId`, `spaceId` and `roomId` from the response and calls `router.replace("?...")`, which makes the rest of the Athena shell switch to the new workspace. It then calls `onCreated`, resets local state, sets `useUIStore.setShowAddWorkspace(false)` and closes.
- Back button decrements the step; the button shows "Creating…" while the store's `isLoadingWorkspacesAndSpaceAndRooms` flag is set.

## Exports
- `AddWorkspaceDialog({ open, onOpenChange, onCreated? })` - controlled dialog; `onCreated` fires after a successful create.

## Interfaces
- **External services:** Taskroom API (`NEXT_PUBLIC_TASKROOM_URL`) via the store - creates workspace, space and room.

## Dependencies
- **Internal:** `store/taskroom/taskroomWorkspace.tsx` (`createWorkspaceAndSpaceAndRooms`, loading flag), `store/taskroom/uiStore.tsx` (`setShowAddWorkspace`), `components/ui/{dialog,button,input}`, `lib/utils.ts` (`cn`).
- **Packages:** `react`, `next/navigation` (`useRouter`, `useSearchParams`), `lucide-react`.

## Used by
- `components/athena/components/workspacesidebar.tsx`
- `components/dashboard/TaskroomWorkspace.tsx`

## Notes
- Errors thrown by the store are only logged to the console; user-facing errors come from the store's toasts.
- Closing the dialog mid-way does not reset the step, usage or name; they persist until a successful create.
