# `store/athena/stageStore.ts`

> Module exporting `Stage`, `useStageStore`.

**Kind:** client state store · **Lines:** 184

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `Stage` | interface |  | 7 |
| `useStageStore` | const | `= create<StageStore>((set, get) => ({ stages: [], isLoading: false, error: null, fetchStages: async…` | 53 |

## Interfaces

- **External HTTP calls:**
  - `GET uatapi.garage.app?size=100` (L63)
- **Other fetch/api calls (target not statically resolvable):**
  - `POST ${process.env.NEXT_PUBLIC_TASKROOM_URL}stages/add` (L92)
  - `PUT ${process.env.NEXT_PUBLIC_TASKROOM_URL}stages/${id}` (L124)
  - `DELETE ${process.env.NEXT_PUBLIC_TASKROOM_URL}stages/${id}` (L158)
- **Environment variables (`process.env`):** `NEXT_PUBLIC_TASKROOM_URL`
- **Browser storage / cookies:** `auth-token` (cookie: get), `garage_tok` (localStorage: get)
- **External hosts mentioned in the code:** `uatapi.garage.app`

## Dependencies

- **Internal:** none
- **Packages:**
  - `zustand` — `create`
  - `js-cookie`
  - `sonner` — `toast`

## Used by

- `components/athena/components/Dashbaord.tsx`
- `components/athena/components/ListView.tsx`
- `store/athena/boardStore.tsx`
