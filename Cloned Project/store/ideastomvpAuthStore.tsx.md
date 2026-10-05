# `store/ideastomvpAuthStore.tsx`

> React hooks `useIdeasToMVPUser`, `useIdeasToMVPIsAuthenticated`, `useIdeasToMVPLogin`, `useIdeasToMVPLogout`.

**Kind:** client state store · **Lines:** 276

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

**Hooks used:** `useIdeasToMVPAuthStore`×5 (local)

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `IdeasToMVPUser` | interface |  | 10 |
| `IdeasToMVPAuthState` | interface |  | 17 |
| `useIdeasToMVPAuthStore` | const | `= create<IdeasToMVPAuthState>()( persist( (set, get) => ({ // Initial state user: null, isAuthentic…` | 40 |
| `useIdeasToMVPUser` | hook | `useIdeasToMVPUser()` | 266 |
| `useIdeasToMVPIsAuthenticated` | hook | `useIdeasToMVPIsAuthenticated()` | 268 |
| `useIdeasToMVPLogin` | hook | `useIdeasToMVPLogin()` | 270 |
| `useIdeasToMVPLogout` | hook | `useIdeasToMVPLogout()` | 272 |
| `useIdeasToMVPError` | hook | `useIdeasToMVPError()` | 274 |

## Interfaces

- **External HTTP calls:**
  - `POST finaid2.accountants.io/user/login` (L163)
- **Environment variables (`process.env`):** `NEXT_PUBLIC_API_BASE_URL`
- **Browser storage / cookies:** `ideastomvp-token` (localStorage: set/remove/get), `ideastomvp-user` (localStorage: get/remove/set), `ideastomvp-isAuthenticated` (localStorage: get/remove/set)
- **External hosts mentioned in the code:** `finaid2.accountants.io`

## Dependencies

- **Internal:** none
- **Packages:**
  - `zustand` — `create`, `persist`, `createJSONStorage`

## Used by

No other file imports this one and it has no automatic entry point — it appears unused (or is loaded dynamically by a path the import graph cannot see).
