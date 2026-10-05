# `server/routes/garageAdminVerify.ts`

> Step-up verification for the admin console — the "Verify your admin" gate that stands in front of the dashboard once per login.

**Kind:** Express router · **Lines:** 151 · **Mounted at:** `/garage-admin` (browser: `/backend/garage-admin`)

<!-- docgen:auto -->

## Purpose
Step-up verification for the admin console — the "Verify your admin"
gate that stands in front of the dashboard once per login.

  GET  /garage-admin/verify/challenge
       Does this admin still owe a verification, and which questions can
       be asked? Returns every prompt (never a hash) so the console can
       offer "Ask me a different question" without another round trip.
  POST /garage-admin/verify  { questionId, answer }
       Correct → re-mints the caller's JWT with `adminVerified: true`.
       Out of attempts → stamps sessionsInvalidatedAt, which kills this
       token server-side, and tells the console to sign out.

Mounted BEFORE garageAdminPageGate in app.ts, so these two endpoints stay
reachable while everything behind the gate is refusing the caller.

See services/adminVerification for the hashing and attempt rules.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Endpoints (2)

| Method | Router path | Browser path | Middleware | Handler | Line |
|---|---|---|---|---|---|
| GET | `/verify/challenge` | `/backend/garage-admin/verify/challenge` | `requireGarageAdminAuth` | inline | 46 |
| POST | `/verify` | `/backend/garage-admin/verify` | `requireGarageAdminAuth` | inline | 71 |

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `default (router)` | default |  | 150 |

## Interfaces

- **Database (Mongoose models used):**
  - `GarageAdminModel` (server/models/garageAdmin.model.ts) — reads: `findById`; **writes:** `updateOne`
- **Environment via `server/config/env.ts`:** `env.JWT_SECRET`

## Dependencies

- **Internal:**
  - `server/config/env.ts` — `env`
  - `server/utils/http.ts` — `ok`, `fail`
  - `server/models/garageAdmin.model.ts` — `GarageAdminModel`
  - `server/middleware/garageAdminAuth.ts` — `requireGarageAdminAuth`, `GarageAdminRequest`
  - `server/services/adminVerification.ts` — `evaluateAnswer`, `isGated`, `listQuestions`, `MAX_ATTEMPTS`, `AdminVerificationState`
- **Packages:**
  - `express` — `Router`
  - `jsonwebtoken`

## Used by

- `server/app.ts`

Entry: mounted in `server/app.ts` at `/garage-admin`.
