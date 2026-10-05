# `server/routes/openclawMessages.ts`

> Express router with 3 endpoints, mounted at `/openclaw-messages`.

**Kind:** Express router · **Lines:** 93 · **Mounted at:** `/openclaw-messages` (browser: `/backend/openclaw-messages`)

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Endpoints (3)

| Method | Router path | Browser path | Middleware | Handler | Line |
|---|---|---|---|---|---|
| GET | `/` | `/backend/openclaw-messages` | `requireAuth` | inline | 16 |
| POST | `/` | `/backend/openclaw-messages` | `requireAuth` | inline | 54 |
| DELETE | `/` | `/backend/openclaw-messages` | `requireAuth` | inline | 79 |

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `default (router)` | default |  | 92 |

## Interfaces

- **Database (Mongoose models used):**
  - `OpenClawMessage` (server/models/openclawMessage.model.ts) — reads: `find`; **writes:** `insertMany`, `deleteMany`

## Dependencies

- **Internal:**
  - `server/middleware/auth.ts` — `requireAuth`
  - `server/models/openclawMessage.model.ts` — `OpenClawMessage`
- **Packages:**
  - `express` — `Router`

## Used by

- `server/app.ts`

Entry: mounted in `server/app.ts` at `/openclaw-messages`.
