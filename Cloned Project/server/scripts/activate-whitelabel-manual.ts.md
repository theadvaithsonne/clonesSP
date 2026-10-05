# `server/scripts/activate-whitelabel-manual.ts`

> One-shot: activate the whitelabel add-on for a specific user + org combination without a payment.

**Kind:** backend one-off script (may write to the production DB) · **Lines:** 169

<!-- docgen:auto -->

## Purpose
One-shot: activate the whitelabel add-on for a specific user + org
combination without a payment. Uses the same OfficeAddonSubscription
shape as the invoice-based purchase path so `hasActiveAddon(orgId,
"white-label")` returns true immediately.

Marked with `metadata.source: "manual_admin_grant"` so it's
distinguishable from paid subscriptions (invoice / razorpay).

Idempotent — re-running against the same user+org either extends
the current cycle or no-ops (see `activateWhitelabelFromInvoice`
behavior; the compound-unique index keeps a single doc per org+addon).

Usage (from roam-backend/):
  npx tsx src/scripts/activate-whitelabel-manual.ts <email> <org-name>

Example: […]

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Exports

None — this file exports nothing.

## Interfaces

- **Database (Mongoose models used):**
  - `User` (server/models/user.model.ts) — reads: `findOne`, `findById`
  - `Organization` (server/models/organization.model.ts) — reads: `find`
  - `OfficeAddon` (server/models/officeAddon.model.ts) — reads: `findOne`
  - `OfficeAddonSubscription` (server/models/officeAddonSubscription.model.ts) — reads: `findOne`; **writes:** `updateOne`
- **Environment via `server/config/env.ts`:** `env.MONGODB_URI`

## Dependencies

- **Internal:**
  - `server/config/env.ts` — `env`
  - `server/models/user.model.ts` — `User`
  - `server/models/organization.model.ts` — `Organization`
  - `server/models/officeAddon.model.ts` — `OfficeAddon`
  - `server/models/officeAddonSubscription.model.ts` — `OfficeAddonSubscription`
  - `server/config/whitelabelAddon.ts` — `WHITELABEL_ADDON`, `whitelabelCycleMs`
- **Packages:**
  - `dotenv`
  - `mongoose` — `Types`

## Used by

Entry: run by hand: `npx tsx server/scripts/activate-whitelabel-manual.ts`.

## Notes

- ⚠ **Connects to `MONGODB_URI`** — in this project that is the **production database** (see `.env`). It performs write operations: `OfficeAddonSubscription` (updateOne).
