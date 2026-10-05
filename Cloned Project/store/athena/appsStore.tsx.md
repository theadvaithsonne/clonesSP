# `store/athena/appsStore.tsx`

> Module exporting `Apps`, `useAppsStore`, `GxAuthResponse`, `useGxUserStore`.

**Kind:** client state store · **Lines:** 76

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `Apps` | interface |  | 3 |
| `useAppsStore` | const | `= create<AppsStore>((set) => ({ apps: [], setApps: (apps) => set({ apps }), shouldReload: true, set…` | 21 |
| `GxAuthResponse` | interface |  | 29 |
| `useGxUserStore` | const | `= create<GxUserStore>((set, get) => ({ gxUser: null, setGxUser: (user) => { set({ gxUser: user }); …` | 56 |

## Interfaces

- **Browser storage / cookies:** `gx-auth-response` (localStorage: set/remove)

## Dependencies

- **Internal:** none
- **Packages:**
  - `zustand` — `create`

## Used by

No other file imports this one and it has no automatic entry point — it appears unused (or is loaded dynamically by a path the import graph cannot see).
