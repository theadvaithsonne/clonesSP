# `store/athena/memberStore.ts`

> Module exporting `Member`, `UserResult`, `PaginationMetadata`, `useMemberStore`.

**Kind:** client state store · **Lines:** 424

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `Member` | interface |  | 8 |
| `UserResult` | interface |  | 35 |
| `PaginationMetadata` | interface |  | 67 |
| `useMemberStore` | const | `= create<MemberStore>((set, get) => ({ members: [], cardMembers: [], assignCardMemberlist: [], pagi…` | 99 |

## Interfaces

- **External HTTP calls:**
  - `PUT uatapi.garage.app/${id}` (L342)
  - `DELETE uatapi.garage.app/${id}` (L368)
- **Other fetch/api calls (target not statically resolvable):**
  - `GET ${process.env.NEXT_PUBLIC_TASKROOM_URL}tasks/${boardId}/assignees` (L152)
  - `GET ${baseUrl}tasks/${boardId}/members?size=50` (L192)
- **Environment variables (`process.env`):** `NEXT_PUBLIC_TASKROOM_URL`
- **Browser storage / cookies:** `garage_tok` (localStorage: get), `auth-token` (cookie: get)
- **External hosts mentioned in the code:** `uatapi.garage.app`

## Dependencies

- **Internal:**
  - `store/athena/boardStore.tsx` — `useBoardStore`
- **Packages:**
  - `zustand` — `create`
  - `js-cookie`
  - `sonner` — `toast`

## Used by

- `components/athena/components/Dashbaord.tsx`
- `components/athena/components/ListView.tsx`
- `components/athena/components/board-members-modal.tsx`
- `components/athena/components/card-modal.tsx`
- `components/athena/components/share-modal.tsx`
