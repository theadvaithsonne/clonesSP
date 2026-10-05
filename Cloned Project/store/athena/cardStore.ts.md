# `store/athena/cardStore.ts`

> Module exporting `Card`, `CreateCardRequest`, `UpdateCardRequest`, `useCardStore`.

**Kind:** client state store · **Lines:** 458

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `Card` | interface |  | 7 |
| `CreateCardRequest` | interface |  | 34 |
| `UpdateCardRequest` | interface |  | 50 |
| `useCardStore` | const | `= create<CardStore>((set, get) => ({ cards: [], isLoading: false, error: null, cardMetadata: {}, sh…` | 99 |

## Interfaces

- **Other fetch/api calls (target not statically resolvable):**
  - `GET ${API_BASE_URL}?boardId=${boardId}&size=${size}&page=${page}` (L112)
  - `GET ${API_BASE_URL}stages/detail/${stageId}?size=${size}&page=${nextPage}` (L164)
  - `POST ${process.env.NEXT_PUBLIC_TASKROOM_URL}tasks` (L228)
  - `PUT ${process.env.NEXT_PUBLIC_TASKROOM_URL}tasks/${id}` (L278)
  - `PUT ${process.env.NEXT_PUBLIC_TASKROOM_URL}tasks/shift/${id}` (L342)
  - `DELETE ${process.env.NEXT_PUBLIC_TASKROOM_URL}tasks/${id}` (L377)
  - `PUT ${API_BASE_URL}/complete/${id}` (L411)
- **Environment variables (`process.env`):** `NEXT_PUBLIC_TASKROOM_URL`
- **Browser storage / cookies:** `auth-token` (cookie: get), `garage_tok` (localStorage: get)

## Dependencies

- **Internal:** none
- **Packages:**
  - `zustand` — `create`
  - `js-cookie`
  - `sonner` — `toast`

## Used by

- `components/athena/components/AssignedToMe.tsx`
- `components/athena/components/CalendarView.tsx`
- `components/athena/components/CreateTaskDialog.tsx`
- `components/athena/components/Dashbaord.tsx`
- `components/athena/components/Gantt.tsx`
- `components/athena/components/ListView.tsx`
- `components/athena/components/card-modal.tsx`
- `components/athena/components/kanban-card.tsx`
- `components/athena/components/kanban-column.tsx`
- `store/athena/boardStore.tsx`
