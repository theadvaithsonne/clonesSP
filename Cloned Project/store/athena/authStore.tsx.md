# `store/athena/authStore.tsx`

> React hooks `useUser`, `useIsAuthenticated`, `useAuthLoading`, `useAuthError`.

**Kind:** client state store · **Lines:** 461

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

**Hooks used:** `useAuthStore`×4 (local)

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `User` | interface |  | 8 |
| `AuthState` | interface |  | 27 |
| `useAuthStore` | const | `= create<AuthState>()( persist( (set, get) => ({ // Initial state user: null, isAuthenticated: fals…` | 52 |
| `useUser` | hook | `useUser()` | 457 |
| `useIsAuthenticated` | hook | `useIsAuthenticated()` | 458 |
| `useAuthLoading` | hook | `useAuthLoading()` | 459 |
| `useAuthError` | hook | `useAuthError()` | 460 |

## Interfaces

- **Browser storage / cookies:** `user-data` (cookie: get/set/remove), `auth-token` (cookie: remove/get/set), `auth-token` (localStorage: get/remove/set), `flowboadUserdata` (cookie: remove), `facebook_leads_integration` (localStorage: get/set)

## Dependencies

- **Internal:**
  - `lib/api-config.ts` — `buildExternalUrl`, `buildInternalUrl`
- **Packages:**
  - `zustand` — `create`, `persist`, `createJSONStorage`
  - `js-cookie`

## Used by

No other file imports this one and it has no automatic entry point — it appears unused (or is loaded dynamically by a path the import graph cannot see).
