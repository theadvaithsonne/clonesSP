# `server/routes/adminNotifications.ts`

> Admin notification rules — CRUD + the event catalogue that drives the condition builder.

**Kind:** Express router · **Lines:** 219 · **Mounted at:** `/garage-admin/notifications` (browser: `/backend/garage-admin/notifications`)

<!-- docgen:auto -->

## Purpose
Admin notification rules — CRUD + the event catalogue that drives the
condition builder.

Delivery is NOT here. Nothing in this file sends mail: it stores rules and
serves the registry. Evaluation and sending land in a later phase, which is
why every rule is created disabled — the surface can be built and reviewed
without a single real email going out.

See docs/superpowers/specs/2026-09-11-admin-notification-rules-design.md.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Endpoints (6)

| Method | Router path | Browser path | Middleware | Handler | Line |
|---|---|---|---|---|---|
| GET | `/events` | `/backend/garage-admin/notifications/events` | `requireGarageAdminAuth` | inline | 97 |
| GET | `/rules` | `/backend/garage-admin/notifications/rules` | `requireGarageAdminAuth` | inline | 102 |
| POST | `/rules` | `/backend/garage-admin/notifications/rules` | `requireGarageAdminAuth` | inline | 113 |
| PATCH | `/rules/:id` | `/backend/garage-admin/notifications/rules/:id` | `requireGarageAdminAuth` | inline | 134 |
| DELETE | `/rules/:id` | `/backend/garage-admin/notifications/rules/:id` | `requireGarageAdminAuth` | inline | 175 |
| GET | `/resolve-user` | `/backend/garage-admin/notifications/resolve-user` | `requireGarageAdminAuth` | inline | 194 |

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `default (router)` | default |  | 218 |

## Interfaces

- **Database (Mongoose models used):**
  - `AdminNotificationRule` (server/models/adminNotificationRule.model.ts) — reads: `find`, `findById`; **writes:** `create`, `findByIdAndUpdate`, `findByIdAndDelete`
  - `User` (server/models/user.model.ts) — reads: `findOne`

## Dependencies

- **Internal:**
  - `server/middleware/garageAdminAuth.ts` — `requireGarageAdminAuth`, `GarageAdminRequest`
  - `server/models/adminNotificationRule.model.ts` — `AdminNotificationRule`
  - `server/models/user.model.ts` — `User`
  - `server/config/adminNotificationEvents.ts` — `ADMIN_EVENTS`, `ADMIN_EVENT_NAMES`, `OPERATORS_BY_TYPE`
- **Packages:**
  - `express` — `Router`, `Response`
  - `mongoose` — `Types`
  - `zod` — `z`

## Used by

- `server/app.ts`

Entry: mounted in `server/app.ts` at `/garage-admin/notifications`.
