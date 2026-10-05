# `store/flowboard/tagStore.ts`

> Module exporting `Tag`, `useTagStore`.

**Kind:** client state store · **Lines:** 128

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `Tag` | interface |  | 8 |
| `useTagStore` | const | `= create<TagStore>((set, get) => ({ isLoading: false, error: null, createTag: async (data: CreateTa…` | 38 |

## Interfaces

- **External HTTP calls:**
  - `POST uatapi.garage.app` (L46)
  - `PUT uatapi.garage.app/${id}` (L77)
  - `DELETE uatapi.garage.app/${id}?socketId=${socketId}` (L107)
- **Browser storage / cookies:** `garage_tok` (localStorage: get)
- **External hosts mentioned in the code:** `uatapi.garage.app`

## Dependencies

- **Internal:**
  - `store/flowboard/boardStore.tsx` — `useBoardStore`, `TagParams`
- **Packages:**
  - `zustand` — `create`
  - `js-cookie`
  - `sonner` — `toast`

## Used by

- `app/(dashboard)/flowboard/[symbol]/components/card-modal.tsx`
