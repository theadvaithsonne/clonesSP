# `store/flowboard/memberStore.ts`

> Module exporting `Member`, `UserResult`, `PaginationMetadata`, `useMemberStore`.

**Kind:** client state store · **Lines:** 435

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `Member` | interface |  | 8 |
| `UserResult` | interface |  | 31 |
| `PaginationMetadata` | interface |  | 63 |
| `useMemberStore` | const | `= create<MemberStore>((set, get) => ({ members: [], cardMembers: [], assignCardMemberlist: [], pagi…` | 95 |

## Interfaces

- **External HTTP calls:**
  - `GET https://uatapi.garage.app/flowboard/v1/cards/${boardId}/assignees` (L150)
  - `GET https://uatapi.garage.app/flowboard/v1/cards/${boardId}/members?size=50` (L186)
  - `PUT uatapi.garage.app/${id}` (L338)
  - `DELETE uatapi.garage.app/${id}` (L364)
- **Environment variables (`process.env`):** `NEXT_PUBLIC_API_URL`
- **Browser storage / cookies:** `garage_tok` (localStorage: get), `garage_org_id` (localStorage: get)
- **External hosts mentioned in the code:** `uatapi.garage.app`

## Dependencies

- **Internal:**
  - `store/flowboard/boardStore.tsx` — `useBoardStore`
- **Packages:**
  - `zustand` — `create`
  - `js-cookie`
  - `sonner` — `toast`

## Used by

- `app/(dashboard)/flowboard/[symbol]/components/board-members-modal.tsx`
- `app/(dashboard)/flowboard/[symbol]/components/card-modal.tsx`
- `app/(dashboard)/flowboard/[symbol]/components/kanban-board-list-view.tsx`
- `app/(dashboard)/flowboard/[symbol]/components/kanban-board.tsx`
- `app/(dashboard)/flowboard/[symbol]/components/share-modal.tsx`
