# `store/flowboard/userStore.ts`

> Module exporting `useUserStore`.

**Kind:** client state store · **Lines:** 71

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `useUserStore` | const | `= create<UserStore>((set) => ({ userProfile: null, isUserProfileFetched: false, isLoading: false, e…` | 19 |

## Interfaces

- **External HTTP calls:**
  - `GET https://uatapi.garage.app/flowboard/v1/users/profile` (L35)
- **Browser storage / cookies:** `garage_tok` (localStorage: get), `flowboadUserdata` (cookie: set)
- **External hosts mentioned in the code:** `uatapi.garage.app`

## Dependencies

- **Internal:** none
- **Packages:**
  - `zustand` — `create`
  - `js-cookie`

## Used by

- `app/(dashboard)/flowboard/[symbol]/components/kanban-board-list-view.tsx`
- `app/(dashboard)/flowboard/[symbol]/components/kanban-board.tsx`
- `app/(dashboard)/flowboard/[symbol]/page.tsx`
- `app/(dashboard)/flowboard/layout.tsx`
- `app/(dashboard)/flowboard/page.tsx`
