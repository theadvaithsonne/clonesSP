# `server/routes/myOfficePlans.ts`

> GET /me/offices/plans — every org the caller is a founder of, with its current OfficeSubscription plan + Cryptosub state + cryptobrand flag.

**Kind:** Express router · **Lines:** 101 · **Mounted at:** `/me` (browser: `/backend/me`)

<!-- docgen:auto -->

## Purpose
GET /me/offices/plans — every org the caller is a founder of, with
its current OfficeSubscription plan + Cryptosub state + cryptobrand
flag. Powers the "my crypto offices" grid so the FE can render a card
per office with the right upgrade CTA.

Read-only, per-user. Non-founder memberships are excluded — this is
specifically the "which of my offices need Pro / Cryptosub"
dashboard question.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Endpoints (1)

| Method | Router path | Browser path | Middleware | Handler | Line |
|---|---|---|---|---|---|
| GET | `/offices/plans` | `/backend/me/offices/plans` | `requireAuth` | inline | 20 |

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `default (router)` | default |  | 100 |

## Interfaces

- **Database (Mongoose models used):**
  - `User` (server/models/user.model.ts) — reads: `findById`
  - `Organization` (server/models/organization.model.ts) — reads: `find`

## Dependencies

- **Internal:**
  - `server/middleware/auth.ts` — `requireAuth`
  - `server/models/user.model.ts` — `User`
  - `server/models/organization.model.ts` — `Organization`
  - `server/services/officePlanStatus.ts` — `getOfficePlanStatusForOrg`
  - `server/services/officeAddonSubscription.ts` — `hasActiveAddon`
- **Packages:**
  - `express` — `Router`, `Request`, `Response`
  - `mongoose` — `Types`

## Used by

- `server/app.ts`

Entry: mounted in `server/app.ts` at `/me`.
