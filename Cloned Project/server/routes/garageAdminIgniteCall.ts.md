# `server/routes/garageAdminIgniteCall.ts`

> Ignite call — the link between a Garage affiliate and a NetworkChains catch-up, plus the reads that back the status column and its side panel.

**Kind:** Express router · **Lines:** 442 · **Mounted at:** `/garage-admin` (browser: `/backend/garage-admin`)

<!-- docgen:auto -->

## Purpose
Ignite call — the link between a Garage affiliate and a NetworkChains
catch-up, plus the reads that back the status column and its side panel.

Guards are attached PER ROUTE, never at the router level: this router
shares the bare /garage-admin mount, where router-level middleware fires
for paths this router does not define and rejects them before the next
router is reached. See CLAUDE.md — that pattern took down admin login in
production.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Endpoints (7)

| Method | Router path | Browser path | Middleware | Handler | Line |
|---|---|---|---|---|---|
| GET | `/admins/:adminId/catchups` | `/backend/garage-admin/admins/:adminId/catchups` | `superAdminOnly` | inline | 53 |
| POST | `/users/:userId/ignite-call` | `/backend/garage-admin/users/:userId/ignite-call` | `superAdminOnly` | inline | 82 |
| DELETE | `/users/:userId/ignite-call/:id` | `/backend/garage-admin/users/:userId/ignite-call/:id` | `superAdminOnly` | inline | 213 |
| GET | `/users/:userId/ignite-calls` | `/backend/garage-admin/users/:userId/ignite-calls` | `adminOnly` | inline | 233 |
| GET | `/ignite-call/:id/related` | `/backend/garage-admin/ignite-call/:id/related` | `adminOnly` | inline | 273 |
| PATCH | `/users/:userId/ignite-call/:id/reschedule` | `/backend/garage-admin/users/:userId/ignite-call/:id/reschedule` | `superAdminOnly` | inline | 331 |
| POST | `/users/:userId/ignite-call/:id/complete` | `/backend/garage-admin/users/:userId/ignite-call/:id/complete` | `superAdminOnly` | inline | 395 |

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `default (router)` | default |  | 441 |

## Interfaces

- **Database (Mongoose models used):**
  - `GarageAdminModel` (server/models/garageAdmin.model.ts) — reads: `findById`, `find`
  - `User` (server/models/user.model.ts) — reads: `findById`
  - `IgniteCallModel` (server/models/igniteCall.model.ts) — reads: `countDocuments`, `find`, `findById`, `findOne`; **writes:** `findOneAndUpdate`, `updateOne`

## Dependencies

- **Internal:**
  - `server/middleware/garageAdminAuth.ts` — `requireGarageAdminAuth`, `requireGarageSuperAdmin`
  - `server/models/igniteCall.model.ts` — `IgniteCallModel`
  - `server/services/igniteCall.service.ts` — `applyManualCompletion`
  - `server/models/user.model.ts` — `User`
  - `server/models/garageAdmin.model.ts` — `GarageAdminModel`
  - `server/lib/ncMeetClient.ts` — `ncHostByEmail`, `ncHostSchedules`, `ncCreateSchedule`, `ncAddAttendee`, `ncScheduleRelated`, `ncRescheduleSchedule`, `NcMeetError`
- **Packages:**
  - `express` — `Router`, `Request`, `Response`
  - `mongoose` — `Types`

## Used by

- `server/app.ts`

Entry: mounted in `server/app.ts` at `/garage-admin`.
