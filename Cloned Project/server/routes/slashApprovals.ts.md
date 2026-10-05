# `server/routes/slashApprovals.ts`

> Express router with 3 endpoints, mounted at `/slash/approvals`.

**Kind:** Express router · **Lines:** 169 · **Mounted at:** `/slash/approvals` (browser: `/backend/slash/approvals`)

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Endpoints (3)

| Method | Router path | Browser path | Middleware | Handler | Line |
|---|---|---|---|---|---|
| POST | `/` | `/backend/slash/approvals` | `requireAuth` | inline | 21 |
| POST | `/:id/decide` | `/backend/slash/approvals/:id/decide` | `requireAuth` | inline | 73 |
| GET | `/:id` | `/backend/slash/approvals/:id` | `requireAuth` | inline | 140 |

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `default (router)` | default |  | 168 |

## Interfaces

- **Socket.IO events:**
  - emits: `slash:approval-created`, `slash:approval-decided`
- **Database (Mongoose models used):**
  - `Approval` (server/models/approval.model.ts) — reads: `findOne`; **writes:** `create`

## Dependencies

- **Internal:**
  - `server/middleware/auth.ts` — `requireAuth`
  - `server/models/approval.model.ts` — `Approval`
  - `server/services/socket.ts` — `getSocketInstance`
- **Packages:**
  - `express` — `Router`
  - `zod` — `z`
  - `mongoose` — `Types`

## Used by

- `server/app.ts`

Entry: mounted in `server/app.ts` at `/slash/approvals`.
