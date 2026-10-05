# `store/athena/checklistStore.ts`

> Module exporting `ChecklistItem`, `useChecklistStore`.

**Kind:** client state store · **Lines:** 188

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `ChecklistItem` | interface |  | 5 |
| `useChecklistStore` | const | `= create<ChecklistStore>((set, get) => ({ checklistItems: [], isLoading: false, error: null, fetchC…` | 40 |

## Interfaces

- **External HTTP calls:**
  - `GET uatapi.garage.app?taskId=${taskId}&boardId=${boardId}&size=100` (L49)
  - `PUT uatapi.garage.app/${checklistId}` (L114)
  - `DELETE uatapi.garage.app/${checklistId}` (L145)
- **Browser storage / cookies:** `auth-token` (cookie: get)
- **External hosts mentioned in the code:** `uatapi.garage.app`

## Dependencies

- **Internal:** none
- **Packages:**
  - `zustand` — `create`
  - `js-cookie`
  - `sonner` — `toast`

## Used by

- `components/athena/components/card-modal.tsx`
