# `store/flowboard/stageStore.ts`

> Module exporting `Stage`, `useStageStore`.

**Kind:** client state store · **Lines:** 176

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `Stage` | interface |  | 7 |
| `useStageStore` | const | `= create<StageStore>((set, get) => ({ stages: [], isLoading: false, error: null, fetchStages: async…` | 47 |

## Interfaces

- **External HTTP calls:**
  - `GET uatapi.garage.app?size=100` (L57)
  - `PUT uatapi.garage.app/${id}` (L118)
  - `DELETE uatapi.garage.app/${id}?boardSocketId=${boardSocketId}&notificationSocketId=${notificationSocketId}` (L150)
- **Browser storage / cookies:** `garage_tok` (localStorage: get)
- **External hosts mentioned in the code:** `uatapi.garage.app`

## Dependencies

- **Internal:** none
- **Packages:**
  - `zustand` — `create`
  - `js-cookie`
  - `sonner` — `toast`

## Used by

- `app/(dashboard)/flowboard/[symbol]/components/kanban-board.tsx`
- `store/flowboard/boardStore.tsx`
