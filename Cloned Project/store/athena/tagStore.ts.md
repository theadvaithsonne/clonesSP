# `store/athena/tagStore.ts`

> Module exporting `Tag`, `useTagStore`.

**Kind:** client state store · **Lines:** 131

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `Tag` | interface |  | 8 |
| `useTagStore` | const | `= create<TagStore>((set, get) => ({ isLoading: false, error: null, createTag: async (data: CreateTa…` | 40 |

## Interfaces

- **Other fetch/api calls (target not statically resolvable):**
  - `POST ${process.env.NEXT_PUBLIC_TASKROOM_URL}tags` (L48)
  - `PUT ${process.env.NEXT_PUBLIC_TASKROOM_URL}tags/${id}` (L79)
  - `DELETE ${process.env.NEXT_PUBLIC_TASKROOM_URL}tags/${id}${query}` (L110)
- **Environment variables (`process.env`):** `NEXT_PUBLIC_TASKROOM_URL`
- **Browser storage / cookies:** `garage_tok` (localStorage: get)
- **External hosts mentioned in the code:** `uatapi.garage.app`

## Dependencies

- **Internal:**
  - `store/athena/boardStore.tsx` — `useBoardStore`, `TagParams`
- **Packages:**
  - `zustand` — `create`
  - `js-cookie`
  - `sonner` — `toast`

## Used by

- `components/athena/components/card-modal.tsx`
- `components/athena/components/tag-picker.tsx`
