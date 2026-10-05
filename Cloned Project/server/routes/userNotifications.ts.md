# `server/routes/userNotifications.ts`

> Express router with 13 endpoints, mounted at `/user-notifications`.

**Kind:** Express router · **Lines:** 359 · **Mounted at:** `/user-notifications` (browser: `/backend/user-notifications`)

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Endpoints (13)

| Method | Router path | Browser path | Middleware | Handler | Line |
|---|---|---|---|---|---|
| GET | `/` | `/backend/user-notifications` | `requireAuth` | inline | 26 |
| GET | `/unread-count` | `/backend/user-notifications/unread-count` | `requireAuth` | inline | 53 |
| POST | `/:notificationId/read` | `/backend/user-notifications/:notificationId/read` | `requireAuth` | inline | 77 |
| POST | `/read-all` | `/backend/user-notifications/read-all` | `requireAuth` | inline | 105 |
| DELETE | `/:notificationId` | `/backend/user-notifications/:notificationId` | `requireAuth` | inline | 132 |
| DELETE | `/` | `/backend/user-notifications` | `requireAuth` | inline | 160 |
| DELETE | `/dm/:dmFromUserId` | `/backend/user-notifications/dm/:dmFromUserId` | `requireAuth` | inline | 186 |
| DELETE | `/group/:groupId` | `/backend/user-notifications/group/:groupId` | `requireAuth` | inline | 218 |
| GET | `/global-dm` | `/backend/user-notifications/global-dm` | `requireAuth` | inline | 247 |
| GET | `/global-dm/unread-count` | `/backend/user-notifications/global-dm/unread-count` | `requireAuth` | inline | 268 |
| POST | `/global-dm/read-all` | `/backend/user-notifications/global-dm/read-all` | `requireAuth` | inline | 287 |
| DELETE | `/global-dm/:globalDmFromUserId` | `/backend/user-notifications/global-dm/:globalDmFromUserId` | `requireAuth` | inline | 311 |
| DELETE | `/global-dm` | `/backend/user-notifications/global-dm` | `requireAuth` | inline | 336 |

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `default (router)` | default |  | 358 |

## Interfaces

- **Database (Mongoose models used):**
  - `UserNotification` (server/models/userNotification.model.ts) — reads: `find`, `countDocuments`; **writes:** `findOneAndUpdate`, `updateMany`

## Dependencies

- **Internal:**
  - `server/middleware/auth.ts` — `requireAuth`
  - `server/models/userNotification.model.ts` — `UserNotification`
- **Packages:**
  - `express` — `Router`
  - `zod` — `z`
  - `mongoose` — `Types`

## Used by

- `server/app.ts`

Entry: mounted in `server/app.ts` at `/user-notifications`.
