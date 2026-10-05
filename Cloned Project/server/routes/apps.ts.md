# `server/routes/apps.ts`

> Express router with 5 endpoints, mounted at `/apps`.

**Kind:** Express router · **Lines:** 324 · **Mounted at:** `/apps` (browser: `/backend/apps`)

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Endpoints (5)

| Method | Router path | Browser path | Middleware | Handler | Line |
|---|---|---|---|---|---|
| GET | `/my` | `/backend/apps/my` | `requireAuth` | inline | 20 |
| POST | `/subscribe` | `/backend/apps/subscribe` | `requireAuth` | inline | 49 |
| DELETE | `/:appId` | `/backend/apps/:appId` | `requireAuth` | inline | 88 |
| GET | `/admin/assignees` | `/backend/apps/admin/assignees` | `requireAuth`, `requireAuth` | inline | 106 |
| POST | `/admin/assign` | `/backend/apps/admin/assign` | `requireAuth`, `requireAuth` | inline | 172 |

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `default (router)` | default |  | 323 |

## Interfaces

- **Database (Mongoose models used):**
  - `User` (server/models/user.model.ts) — reads: `find`
  - `AppSubscription` (server/models/appSubscription.model.ts) — reads: `find`, `findOne`; **writes:** `updateOne`, `deleteOne`, `bulkWrite`, `deleteMany`, `updateMany`
- **External hosts mentioned in the code:** `my.garage.app`, `www.earngpt.io`, `app.indianinvestor.com`, `web.whatsapp.com`, `mail.google.com`

## Dependencies

- **Internal:**
  - `server/middleware/auth.ts` — `requireAuth`
  - `server/models/appSubscription.model.ts` — `AppSubscription`
  - `server/models/user.model.ts` — `User`
- **Packages:**
  - `express` — `Router`
  - `zod` — `z`
  - `mongoose` — `Types`

## Used by

- `server/app.ts`

Entry: mounted in `server/app.ts` at `/apps`.
