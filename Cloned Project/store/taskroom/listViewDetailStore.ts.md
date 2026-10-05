# `store/taskroom/listViewDetailStore.ts`

> Module exporting `TaskroomTaskDetail`, `TaskroomSubtaskDetail`, `TaskroomstageDetail`, `useListViewDetailStore`.

**Kind:** client state store · **Lines:** 155

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `TaskroomTaskDetail` | type |  | 11 |
| `TaskroomSubtaskDetail` | type |  | 12 |
| `TaskroomstageDetail` | type |  | 13 |
| `useListViewDetailStore` | const | `= create<ListViewDetailState>((set, get) => ({ isLoadingRoom: true, isLoadingTask: false, isLoading…` | 51 |

## Interfaces

- **Other fetch/api calls (target not statically resolvable):**
  - `GET ${process.env.NEXT_PUBLIC_TASKROOM_URL}rooms/detail/${roomId}` (L79)
  - `GET ${base}tasks/detail/${taskId}` (L104)
  - `GET ${base}subtask/detail/${subtaskId}` (L132)
- **Environment variables (`process.env`):** `NEXT_PUBLIC_TASKROOM_API_BASE_URL`, `NEXT_PUBLIC_TASKROOM_BASE_URL`, `NEXT_PUBLIC_TASKROOM_URL`
- **Browser storage / cookies:** `garage_tok` (localStorage: get)
- **External hosts mentioned in the code:** `uatapi.garage.app`

## Dependencies

- **Internal:** none
- **Packages:**
  - `zustand` — `create`
  - `axios`

## Used by

- `app/(dashboard)/taskroom/all-taskrooms/componentsSymbol/TaskListView.tsx`
- `app/taskroom/Layout.tsx`
- `app/taskroom/[workspace]/dashboard/[space]/page.tsx`
