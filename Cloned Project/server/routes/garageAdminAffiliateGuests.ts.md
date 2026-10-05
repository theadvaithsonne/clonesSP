# `server/routes/garageAdminAffiliateGuests.ts`

> Super-admin surface for graduating "affiliate guests" — users who signed up via the OTP flow and got auto-joined to some org as `organizations.$.guest === true`.

**Kind:** Express router · **Lines:** 174 · **Mounted at:** `/garage-admin` (browser: `/backend/garage-admin`)

<!-- docgen:auto -->

## Purpose
Super-admin surface for graduating "affiliate guests" — users who
signed up via the OTP flow and got auto-joined to some org as
`organizations.$.guest === true`. The default new-user path stamps
guest:true in GARAGE HQ; founders can also invite users as guests
via the join-request approval flow. This admin tab lets Shorupan
flip that flag to `false` in one click, promoting the user to a full
member of the org.

Endpoints:
  GET  /garage-admin/affiliate-guests
    List users with at least one guest:true membership. Server-side
    search via ?q= (name / email / phone regex).

  PATCH /garage-admin/affiliate-guests/:userId/orgs/:orgId/graduate
    Flip that specific membership's guest flag → false. Idempotent
    (already false → no-op success). Returns the updated membership.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Endpoints (2)

| Method | Router path | Browser path | Middleware | Handler | Line |
|---|---|---|---|---|---|
| GET | `/affiliate-guests` | `/backend/garage-admin/affiliate-guests` | `requireGarageAdminAuth` | inline | 45 |
| PATCH | `/affiliate-guests/:userId/orgs/:orgId/graduate` | `/backend/garage-admin/affiliate-guests/:userId/orgs/:orgId/graduate` | `requireGarageAdminAuth` | inline | 129 |

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `default (router)` | default |  | 173 |

## Interfaces

- **Database (Mongoose models used):**
  - `User` (server/models/user.model.ts) — reads: `find`, `countDocuments`; **writes:** `updateOne`
  - `Organization` (server/models/organization.model.ts) — reads: `find`

## Dependencies

- **Internal:**
  - `server/middleware/garageAdminAuth.ts` — `requireGarageAdminAuth`
  - `server/models/user.model.ts` — `User`
  - `server/models/organization.model.ts` — `Organization`
- **Packages:**
  - `express` — `Router`, `Request`, `Response`
  - `mongoose` — `Types`

## Used by

- `server/app.ts`

Entry: mounted in `server/app.ts` at `/garage-admin`.
