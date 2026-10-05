# `server/scripts/deactivate-whitelabel-manual.ts`

> One-shot: deactivate the whitelabel add-on for an org — the reverse of `activate-whitelabel-manual.ts`.

**Kind:** backend one-off script (may write to the production DB) · **Lines:** 167

<!-- docgen:auto -->

## Purpose
One-shot: deactivate the whitelabel add-on for an org — the reverse of
`activate-whitelabel-manual.ts`.

Flips the org's OfficeAddonSubscription for the whitelabel addon to
`status: "cancelled"` so `hasActiveAddon(orgId, "white-label")` returns
false immediately (`getActiveOfficeAddonSubscription` only matches
status active/authenticated). Also stamps cancelledAt/endedAt, pulls
`currentEnd` back to now, and clears `chargeAt` so nothing can treat the
cycle as still running.

The row is KEPT, not deleted — `metadata.source` and the grant history
stay auditable, and re-running the activate script restores access.

Safe by default: prints what it WOULD change and exits. Pass --confirm to
actually write.
 […]

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Exports

None — this file exports nothing.

## Interfaces

- **Database (Mongoose models used):**
  - `Organization` (server/models/organization.model.ts) — reads: `find`
  - `OfficeAddon` (server/models/officeAddon.model.ts) — reads: `findOne`
  - `OfficeAddonSubscription` (server/models/officeAddonSubscription.model.ts) — reads: `findOne`, `findById`; **writes:** `updateOne`
- **Environment via `server/config/env.ts`:** `env.MONGODB_URI`

## Dependencies

- **Internal:**
  - `server/config/env.ts` — `env`
  - `server/models/organization.model.ts` — `Organization`
  - `server/models/officeAddon.model.ts` — `OfficeAddon`
  - `server/models/officeAddonSubscription.model.ts` — `OfficeAddonSubscription`
  - `server/config/whitelabelAddon.ts` — `WHITELABEL_ADDON`
- **Packages:**
  - `dotenv`
  - `mongoose` — `Types`

## Used by

Entry: run by hand: `npx tsx server/scripts/deactivate-whitelabel-manual.ts`.

## Notes

- ⚠ **Connects to `MONGODB_URI`** — in this project that is the **production database** (see `.env`). It performs write operations: `OfficeAddonSubscription` (updateOne).
- Command-line flags referenced: `--confirm`.
