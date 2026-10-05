# `server/routes/territoryWallet.ts`

> Express router with 2 endpoints, mounted at `/territory-wallet`.

**Kind:** Express router · **Lines:** 136 · **Mounted at:** `/territory-wallet` (browser: `/backend/territory-wallet`)

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Endpoints (2)

| Method | Router path | Browser path | Middleware | Handler | Line |
|---|---|---|---|---|---|
| GET | `/` | `/backend/territory-wallet` | — | inline | 24 |
| POST | `/transfer` | `/backend/territory-wallet/transfer` | — | inline | 62 |

**Router-level middleware** (`router.use`, runs before route matching):
- `requireAuth` (L16)

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `default (router)` | default |  | 135 |

## Interfaces

- **Database (Mongoose models used):**
  - `TerritoryWallet` (server/models/territoryWallet.model.ts) — reads: `findOne`

## Dependencies

- **Internal:**
  - `server/middleware/auth.ts` — `requireAuth`
  - `server/models/territoryWallet.model.ts` — `TerritoryWallet`
  - `server/services/territoryWalletTransfer.ts` — `transferTerritoryToStoreWallet`
- **Packages:**
  - `express` — `Router`, `Request`, `Response`
  - `mongoose`
  - `zod` — `z`

## Used by

- `server/app.ts`

Entry: mounted in `server/app.ts` at `/territory-wallet`.
