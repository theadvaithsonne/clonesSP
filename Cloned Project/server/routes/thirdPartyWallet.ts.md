# `server/routes/thirdPartyWallet.ts`

> Express router with 1 endpoint, mounted at `/api/v1/third-party`.

**Kind:** Express router · **Lines:** 180 · **Mounted at:** `/api/v1/third-party` (browser: `/backend/api/v1/third-party`)

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Endpoints (1)

| Method | Router path | Browser path | Middleware | Handler | Line |
|---|---|---|---|---|---|
| POST | `/wallet/credit` | `/backend/api/v1/third-party/wallet/credit` | `requireScope("wallet:credit")` | inline | 75 |

**Router-level middleware** (`router.use`, runs before route matching):
- `requireThirdPartyApiKey` (L32)

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `default (router)` | default |  | 179 |

## Interfaces

- **Database (Mongoose models used):**
  - `User` (server/models/user.model.ts) — reads: `findById`, `findOne`

## Dependencies

- **Internal:**
  - `server/middleware/thirdPartyAuth.ts` — `requireThirdPartyApiKey`, `requireScope`
  - `server/models/thirdPartyClient.model.ts` — `IThirdPartyClient`
  - `server/models/user.model.ts` — `User`
  - `server/services/wallet.ts` — `creditStoreWalletExternal`
- **Packages:**
  - `express` — `Router`, `Request`, `Response`
  - `zod` — `z`
  - `mongoose`

## Used by

- `server/app.ts`

Entry: mounted in `server/app.ts` at `/api/v1/third-party`.
