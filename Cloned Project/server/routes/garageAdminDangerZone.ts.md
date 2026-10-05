# `server/routes/garageAdminDangerZone.ts`

> Express router with 8 endpoints, mounted at `/garage-admin`.

**Kind:** Express router · **Lines:** 638 · **Mounted at:** `/garage-admin` (browser: `/backend/garage-admin`)

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Endpoints (8)

| Method | Router path | Browser path | Middleware | Handler | Line |
|---|---|---|---|---|---|
| GET | `/users/:id/delete-preview` | `/backend/garage-admin/users/:id/delete-preview` | `superAdminOnly` | inline | 156 |
| DELETE | `/users/:id` | `/backend/garage-admin/users/:id` | `superAdminOnly` | inline | 207 |
| DELETE | `/users/:id/phone` | `/backend/garage-admin/users/:id/phone` | `superAdminOnly` | inline | 276 |
| PATCH | `/users/:id/email-verification` | `/backend/garage-admin/users/:id/email-verification` | `superAdminOnly` | inline | 331 |
| PATCH | `/users/:id/complete-profile` | `/backend/garage-admin/users/:id/complete-profile` | `superAdminOnly` | inline | 387 |
| PATCH | `/users/:id/phone-verification` | `/backend/garage-admin/users/:id/phone-verification` | `superAdminOnly` | inline | 493 |
| GET | `/organizations/:id/delete-preview` | `/backend/garage-admin/organizations/:id/delete-preview` | `superAdminOnly` | inline | 543 |
| DELETE | `/organizations/:id` | `/backend/garage-admin/organizations/:id` | `superAdminOnly` | inline | 594 |

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `default (router)` | default |  | 637 |

## Interfaces

- **Database (Mongoose models used):**
  - `User` (server/models/user.model.ts) — reads: `findById`, `findOne`, `countDocuments`; **writes:** `deleteOne`, `updateOne`, `updateMany`
  - `Organization` (server/models/organization.model.ts) — reads: `findById`; **writes:** `deleteOne`

## Dependencies

- **Internal:**
  - `server/models/user.model.ts` — `User`
  - `server/models/organization.model.ts` — `Organization`
  - `server/middleware/garageAdminAuth.ts` — `requireGarageAdminAuth`, `requireGarageSuperAdmin`, `GarageAdminRequest`
- **Packages:**
  - `express` — `Router`, `Response`
  - `mongoose` — `Types`

## Used by

- `server/app.ts`

Entry: mounted in `server/app.ts` at `/garage-admin`.
