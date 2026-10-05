# `store/flowboard/taskStore.ts`

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

- **External HTTP calls:**
  - `GET uatapi.garage.app?cardId=${cardId}&size=5&page=${page}` (L83)
  - `POST uatapi.garage.app/` (L121)
  - `PUT uatapi.garage.app/${taskId}` (L184)
  - `DELETE uatapi.garage.app/${taskId}?socketId=${socketId}` (L214)
- **Browser storage / cookies:** `garage_tok` (localStorage: get)
- **External hosts mentioned in the code:** `uatapi.garage.app`

## Dependencies

- **Internal:** none
- **Packages:**
  - `zustand` — `create`
  - `js-cookie`
  - `sonner` — `toast`

## Used by

- `app/(dashboard)/flowboard/[symbol]/components/card-modal.tsx`
- `app/(dashboard)/flowboard/[symbol]/components/kanban-board.tsx`
- `app/(dashboard)/flowboard/lib/board-socket-service.ts`
