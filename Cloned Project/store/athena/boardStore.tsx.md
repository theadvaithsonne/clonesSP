# `store/athena/boardStore.tsx`

> Module exporting `Board`, `Metadata`, `TagParams`, `useBoardStore`.

**Kind:** client state store · **Lines:** 854

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
  - `GET https://uatapi.garage.app/flowboard/v1/members/myBoards?page=${page}&size=20` (L257)
  - `GET https://uatapi.garage.app/flowboard/v1/members/myBoards?page=${page}&size=20&isFavorite=true` (L305)
  - `GET https://uatapi.garage.app/flowboard/v1/members/myBoards?page=${page}&size=20&isFavorite=false` (L352)
  - `PUT uatapi.garage.app/${id}` (L455)
  - `DELETE uatapi.garage.app/${id}?notificationSocketId=${notificationSocketId}` (L515)
  - `PUT https://uatapi.garage.app/flowboard/v1/boards/favorite/${id}` (L591)
  - `GET uatapi.garage.app/detail/${boardId}?page=${page}&size=${size}&sortBy=createdAt&sortOrder=${sortOrder}&stageId=${stageId}` (L624)
  - `GET https://uatapi.garage.app/flowboard/v1/members/myBoards?page=1&size=50&boardId=${boardId}` (L812)
- **Other fetch/api calls (target not statically resolvable):**
  - `GET ${process.env.NEXT_PUBLIC_TASKROOM_URL}rooms/detail/${boardId}?page=${page}&size=${size}&cardSize=30` (L728)
- **Environment variables (`process.env`):** `NEXT_PUBLIC_TASKROOM_URL`
- **Browser storage / cookies:** `auth-token` (cookie: get), `garage_tok` (localStorage: get)
- **External hosts mentioned in the code:** `uatapi.garage.app`

## Dependencies

- **Internal:**
  - `store/athena/stageStore.ts` — `useStageStore`
  - `store/athena/cardStore.ts` — `useCardStore`
- **Packages:**
  - `zustand` — `create`
  - `js-cookie`
  - `sonner` — `toast`

## Used by

- `components/athena/components/CalendarView.tsx`
- `components/athena/components/Dashbaord.tsx`
- `components/athena/components/Gantt.tsx`
- `components/athena/components/ListView.tsx`
- `components/athena/components/card-modal.tsx`
- `components/dashboard/taskroomSiderBar.tsx`
- `store/athena/memberStore.ts`
- `store/athena/tagStore.ts`
