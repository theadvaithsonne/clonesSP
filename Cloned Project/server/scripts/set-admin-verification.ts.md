# `server/scripts/set-admin-verification.ts`

> Seed (or clear) the "Verify your admin" step-up questions for one admin.

**Kind:** backend one-off script (may write to the production DB) · **Lines:** 174

<!-- docgen:auto -->

## Purpose
Seed (or clear) the "Verify your admin" step-up questions for one admin.

  npx tsx src/scripts/set-admin-verification.ts --email shorupan@gmail.com
  npx tsx src/scripts/set-admin-verification.ts --email … --status
  npx tsx src/scripts/set-admin-verification.ts --email … --clear

Answers are typed at the prompt, never passed as arguments — argv is
visible in `ps` and lands in shell history. They are hashed with bcrypt
over ADMIN_VERIFY_PEPPER and are not recoverable afterwards, from this
script or anywhere else. Losing them means re-running with --clear.

--clear is the recovery path when the gate locks the only super admin
out; ADMIN_VERIFY_ENFORCE=off in the environment is the faster one.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Exports

None — this file exports nothing.

## Interfaces

- **Database (Mongoose models used):**
  - `GarageAdminModel` (server/models/garageAdmin.model.ts) — reads: `findOne`; **writes:** `updateOne`
- **Environment variables (`process.env`):** `ADMIN_VERIFY_PEPPER`, `JWT_SECRET`, `MONGODB_URI`

## Dependencies

- **Internal:**
  - `server/services/adminVerification.ts` — `hashAnswer`, `normalizeAnswer`
  - `server/models/garageAdmin.model.ts` — `GarageAdminModel`
- **Packages:**
  - `dotenv`
  - `mongoose`
  - `readline`

## Used by

Entry: run by hand: `npx tsx server/scripts/set-admin-verification.ts`.

## Notes

- ⚠ **Connects to `MONGODB_URI`** — in this project that is the **production database** (see `.env`). It performs write operations: `GarageAdminModel` (updateOne).
- Command-line flags referenced: `--clear`, `--status`.
