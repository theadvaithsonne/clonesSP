# `components/dashboard/service-taskroom/TaskroomDestinationPicker.tsx`

> Taskroom destination for a service — workspace, space and template room — shown in Section 6 of the Create Digital Service wizard.

**Kind:** React component · **Lines:** 611 · **Directive:** `"use client"`

<!-- docgen:auto -->

## Purpose
Taskroom destination for a service — workspace, space and template room —
shown in Section 6 of the Create Digital Service wizard.

The three levels are picked side by side because Taskroom enforces the
hierarchy: a space belongs to a workspace, a room belongs to a space. Picking
here rather than letting the server guess at provisioning time is what makes
the destination deterministic: the chosen ids are stored on the service and
used verbatim.

What each level is for:
 - Workspace — where every client room for this service is filed.
 - Space     — the folder inside it. Left empty, provisioning resolves (or
               creates) a "Client Engagements" space on first opt-in.
 - Room      — optional master board for the service itself. Milestones and
               tasks are seeded into it when the service is published. Each
               client still gets their own private room, so no buyer ever […]

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Composition

**Renders:** `PickerColumn`×3 (local), `Loader2`×2 (lucide-react), `Check`×2 (lucide-react), `RefreshCw` (lucide-react), `X` (lucide-react), `FolderPlus` (lucide-react)

### Props

- **`TaskroomDestinationPicker`**: `workspaceId?: string`, `spaceId?: string`, `roomId?: string`, `serviceTitle?: string`, `onChange: (destination: { workspaceId?: string; spaceId?: string; roo…`

**Hooks used:** `useState`×12, `useCallback`×3, `useEffect`×3

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `TaskroomWorkspace` | interface |  | 33 |
| `TaskroomSpace` | interface |  | 40 |
| `TaskroomRoom` | interface |  | 47 |
| `listTaskroomWorkspaces` | function | `async listTaskroomWorkspaces(): Promise<TaskroomWorkspace[]>` — Workspaces the founder is a member of. | 86 |
| `createTaskroomWorkspace` | function | `async createTaskroomWorkspace(name: string): Promise<TaskroomWorkspace>` | 94 |
| `listTaskroomSpaces` | function | `async listTaskroomSpaces(workspaceId: string): Promise<TaskroomSpace[]>` | 107 |
| `createTaskroomSpace` | function | `async createTaskroomSpace(name: string, workspaceId: string): Promise<TaskroomSpace>` | 118 |
| `listTaskroomRooms` | function | `async listTaskroomRooms(spaceId: string): Promise<TaskroomRoom[]>` | 142 |
| `createTaskroomRoom` | function | `async createTaskroomRoom(name: string, spaceId: string): Promise<TaskroomRoom>` | 150 |
| `TaskroomDestinationPicker` | component | `TaskroomDestinationPicker({ workspaceId, spaceId, roomId, serviceTitle, onChange, }: …)` | 362 |

## Interfaces

- **Other fetch/api calls (target not statically resolvable):**
  - `GET ${TASKROOM_URL}workspaces/me?size=50&page=1` (L88)
  - `POST ${TASKROOM_URL}workspaces` (L98)
  - `GET ${TASKROOM_URL}spaces/me?workspaceId=${workspaceId}&page=1&size=50` (L111)
  - `POST ${TASKROOM_URL}spaces` (L123)
  - `GET ${TASKROOM_URL}rooms/me?spaceId=${spaceId}&size=50&page=1` (L144)
  - `POST ${TASKROOM_URL}rooms` (L155)
- **Environment variables (`process.env`):** `NEXT_PUBLIC_TASKROOM_URL`
- **Browser storage / cookies:** `garage_tok` (localStorage: get)

## Dependencies

- **Internal:**
  - `lib/utils.ts` — `cn`
- **Packages:**
  - `react` — `useCallback`, `useEffect`, `useState`
  - `axios`
  - `lucide-react` — `Check`, `FolderPlus`, `Loader2`, `RefreshCw`, `X`
  - `sonner` — `toast`

## Used by

- `components/dashboard/service-taskroom/TaskroomVisibilitySection.tsx`
