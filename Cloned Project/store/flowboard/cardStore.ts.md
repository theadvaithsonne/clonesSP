# `store/flowboard/cardStore.ts`

> Module exporting `Card`, `CreateCardRequest`, `UpdateCardRequest`, `useCardStore`.

**Kind:** client state store · **Lines:** 431

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `Card` | interface |  | 8 |
| `CreateCardRequest` | interface |  | 35 |
| `UpdateCardRequest` | interface |  | 46 |
| `useCardStore` | const | `= create<CardStore>((set, get) => ({ cards: [], isLoading: false, error: null, cardMetadata: {}, fe…` | 91 |

## Interfaces

- **External HTTP calls:**
  - `GET uatapi.garage.app?boardId=${boardId}&size=${size}&page=${page}` (L101)
  - `GET uatapi.garage.app/list?boardId=${boardId}&stageId=${stageId}&size=${size}&page=${nextPage}` (L152)
  - `PUT uatapi.garage.app/${id}` (L270)
  - `PUT uatapi.garage.app/move/${id}` (L324)
  - `DELETE uatapi.garage.app/${id}?boardSocketId=${boardSocketId}&notificationSocketId=${notificationSocketId}` (L351)
  - `PUT uatapi.garage.app/complete/${id}` (L385)
- **Browser storage / cookies:** `garage_tok` (localStorage: get)
- **External hosts mentioned in the code:** `uatapi.garage.app`

## Dependencies

- **Internal:**
  - `app/(dashboard)/flowboard/lib/board-socket-service.ts` — `boardSocketService`
  - `app/(dashboard)/flowboard/lib/notification-socket-service.ts` — `notificationSocketService`
- **Packages:**
  - `zustand` — `create`
  - `js-cookie`
  - `sonner` — `toast`

## Used by

- `app/(dashboard)/flowboard/[symbol]/components/card-modal.tsx`
- `app/(dashboard)/flowboard/[symbol]/components/kanban-board-list-view.tsx`
- `app/(dashboard)/flowboard/[symbol]/components/kanban-board.tsx`
- `app/(dashboard)/flowboard/[symbol]/components/kanban-card.tsx`
- `app/(dashboard)/flowboard/[symbol]/components/kanban-column.tsx`
- `store/flowboard/boardStore.tsx`
