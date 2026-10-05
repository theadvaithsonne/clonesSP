# `server/routes/auction.ts`

> Express router with 5 endpoints, mounted at `/auctions`.

**Kind:** Express router · **Lines:** 234 · **Mounted at:** `/auctions` (browser: `/backend/auctions`)

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Endpoints (5)

| Method | Router path | Browser path | Middleware | Handler | Line |
|---|---|---|---|---|---|
| GET | `/my-products` | `/backend/auctions/my-products` | — | inline | 15 |
| GET | `/` | `/backend/auctions` | — | inline | 57 |
| POST | `/` | `/backend/auctions` | — | inline | 70 |
| PUT | `/:id` | `/backend/auctions/:id` | — | inline | 142 |
| PATCH | `/:id/cancel` | `/backend/auctions/:id/cancel` | — | inline | 205 |

**Router-level middleware** (`router.use`, runs before route matching):
- `requireAuth` (L12)

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `default (router)` | default |  | 233 |

## Interfaces

- **Database (Mongoose models used):**
  - `User` (server/models/user.model.ts) — reads: `findById`
  - `Product` (server/models/product.model.ts) — reads: `find`
  - `Auction` (server/models/auction.model.ts) — reads: `find`, `findById`; **writes:** `create`
  - `Organization` (server/models/organization.model.ts) — reads: `findById`

## Dependencies

- **Internal:**
  - `server/middleware/auth.ts` — `requireAuth`, `AuthRequest`
  - `server/models/auction.model.ts` — `Auction`
  - `server/models/organization.model.ts` — `Organization`
  - `server/models/user.model.ts` — `User`
  - `server/models/product.model.ts` — `Product`
  - `server/services/socket.ts` — `emitAuctionNew`, `emitAuctionUpdate`, `emitAuctionEnd`
- **Packages:**
  - `express` — `Router`
  - `mongoose` — `Types`

## Used by

- `server/app.ts`

Entry: mounted in `server/app.ts` at `/auctions`.
