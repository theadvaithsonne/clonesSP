# `store/flowboard/boardStore.tsx`

> Module exporting `Board`, `Metadata`, `TagParams`, `useBoardStore`.

**Kind:** client state store · **Lines:** 882

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `Board` | interface |  | 9 |
| `Metadata` | interface |  | 37 |
| `TagParams` | interface |  | 143 |
| `useBoardStore` | const | `= create<BoardStore>((set, get) => ({ // All Boards state allBoards: [], allBoardsMetadata: null, i…` | 150 |

## Interfaces

- **External HTTP calls:**
  - `GET https://uatapi.garage.app/flowboard/v1/members/myBoards?page=${page}&size=20` (L259)
  - `GET https://uatapi.garage.app/flowboard/v1/members/myBoards?page=${page}&size=20&isFavorite=true` (L310)
  - `GET https://uatapi.garage.app/flowboard/v1/members/myBoards?page=${page}&size=20&isFavorite=false` (L360)
  - `PUT uatapi.garage.app/${id}` (L465)
  - `DELETE uatapi.garage.app/${id}?notificationSocketId=${notificationSocketId}` (L525)
  - `PUT https://uatapi.garage.app/flowboard/v1/boards/favorite/${id}` (L601)
  - `GET uatapi.garage.app/detail/${boardId}?page=${page}&size=${size}&sortBy=createdAt&sortOrder=${sortOrder}&stageId=${stageId}` (L634)
  - `GET uatapi.garage.app/detail/${boardId}?page=${page}&size=${size}&sortBy=createdAt&sortOrder=${sortOrder}` (L739)
  - `GET https://uatapi.garage.app/flowboard/v1/members/myBoards?page=1&size=50&boardId=${boardId}` (L840)
- **Browser storage / cookies:** `garage_tok` (localStorage: get)
- **External hosts mentioned in the code:** `uatapi.garage.app`

## Dependencies

- **Internal:**
  - `store/flowboard/stageStore.ts` — `useStageStore`
  - `store/flowboard/cardStore.ts` — `useCardStore`
- **Packages:**
  - `zustand` — `create`
  - `js-cookie`
  - `sonner` — `toast`

## Used by

- `app/(dashboard)/flowboard/[symbol]/components/card-modal.tsx`
- `app/(dashboard)/flowboard/[symbol]/components/kanban-board-list-view.tsx`
- `app/(dashboard)/flowboard/[symbol]/components/kanban-board.tsx`
- `app/(dashboard)/flowboard/[symbol]/components/search-result-item.tsx`
- `app/(dashboard)/flowboard/page.tsx`
- `store/flowboard/memberStore.ts`
- `store/flowboard/tagStore.ts`
