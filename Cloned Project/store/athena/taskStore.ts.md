# `store/athena/taskStore.ts`

> Module exporting `Task`, `useTaskStore`.

**Kind:** client state store · **Lines:** 368

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `Task` | interface |  | 5 |
| `useTaskStore` | const | `= create<TaskStore>((set, get) => ({ tasks: [], isLoading: false, error: null, currentPage: 1, tota…` | 50 |

## Interfaces

- **Other fetch/api calls (target not statically resolvable):**
  - `GET ${process.env.NEXT_PUBLIC_TASKROOM_URL}checklist/groups?taskId=${cardId}&size=5&page=${page}` (L82)
  - `POST ${process.env.NEXT_PUBLIC_TASKROOM_URL}checklist/groups` (L119)
  - `PUT ${process.env.NEXT_PUBLIC_TASKROOM_URL}checklist/groups/${taskId}` (L184)
  - `DELETE ${process.env.NEXT_PUBLIC_TASKROOM_URL}checklist/groups/${taskId}` (L215)
- **Environment variables (`process.env`):** `NEXT_PUBLIC_TASKROOM_URL`
- **Browser storage / cookies:** `garage_tok` (localStorage: get)
- **External hosts mentioned in the code:** `uatapi.garage.app`

## Dependencies

- **Internal:** none
- **Packages:**
  - `zustand` — `create`
  - `js-cookie`
  - `sonner` — `toast`

## Used by

- `components/athena/components/Dashbaord.tsx`
- `components/athena/components/ListView.tsx`
- `components/athena/components/card-modal.tsx`
