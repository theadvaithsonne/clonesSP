# `server/routes/franchise.ts`

> Express router with 1 endpoint, mounted at `/franchise`.

**Kind:** Express router · **Lines:** 105 · **Mounted at:** `/franchise` (browser: `/backend/franchise`)

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Endpoints (1)

| Method | Router path | Browser path | Middleware | Handler | Line |
|---|---|---|---|---|---|
| GET | `/wallet` | `/backend/franchise/wallet` | `requireAuth` | inline | 31 |

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `default (router)` | default |  | 104 |

## Interfaces

- **Database (Mongoose models used):**
  - `User` (server/models/user.model.ts) — reads: `findById`
  - `TerritoryWallet` (server/models/territoryWallet.model.ts) — reads: `findOne`
  - `TerritoryWalletTransaction` (server/models/territoryWalletTransaction.model.ts) — reads: `find`

## Dependencies

- **Internal:**
  - `server/middleware/auth.ts` — `requireAuth`, `AuthRequest`
  - `server/models/user.model.ts` — `User`
  - `server/models/territoryWallet.model.ts` — `TerritoryWallet`
  - `server/models/territoryWalletTransaction.model.ts` — `TerritoryWalletTransaction`
- **Packages:**
  - `express` — `Router`, `Request`, `Response`
  - `mongoose` — `Types`

## Used by

- `server/app.ts`

Entry: mounted in `server/app.ts` at `/franchise`.
