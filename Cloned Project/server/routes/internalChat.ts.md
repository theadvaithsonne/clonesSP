# `server/routes/internalChat.ts`

> Express router with 1 endpoint, mounted at `/internal/chat`.

**Kind:** Express router · **Lines:** 56 · **Mounted at:** `/internal/chat` (browser: `/backend/internal/chat`)

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Endpoints (1)

| Method | Router path | Browser path | Middleware | Handler | Line |
|---|---|---|---|---|---|
| POST | `/message` | `/backend/internal/chat/message` | — | inline | 10 |

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `default (router)` | default |  | 55 |

## Interfaces

- **Socket.IO events:**
  - emits: `openclaw:new-message`
- **Database (Mongoose models used):**
  - `OpenClawMessage` (server/models/openclawMessage.model.ts) — **writes:** `create`
- **Environment variables (`process.env`):** `GARAGE_INTERNAL_API_KEY`

## Dependencies

- **Internal:**
  - `server/models/openclawMessage.model.ts` — `OpenClawMessage`
  - `server/services/socket.ts` — `getSocketInstance`
- **Packages:**
  - `express` — `Router`, `Request`, `Response`

## Used by

- `server/app.ts`

Entry: mounted in `server/app.ts` at `/internal/chat`.
