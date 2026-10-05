# `server/scripts/backfill-channel-members.ts`

> Enrol every member of an org into one of its free communities.

**Kind:** backend one-off script (may write to the production DB) · **Lines:** 168

<!-- docgen:auto -->

## Purpose
Enrol every member of an org into one of its free communities.

A community flagged `mandatoryOnJoin` auto-enrols people who join the org
AFTER the flag was set; everyone already in the org is left out. This
closes that gap, e.g. Garage HQ's "For Affiliates" (Sep 2026: 645 in,
1,037 HQ members missing).

Does exactly what services/channel.ts::addUserToChannel does — membership
upsert (reactivating anyone who left) plus the $0 "channel_auto_join"
invoice every auto-join records — but AWAITS the invoice mint instead of
backgrounding it, so the process can't exit with mints still in flight.
No buyer email is sent (the free-join path never does); founder alerts
fire only if the channel has them enabled — check before a big run.

Refuses paid channels: auto-enrolling into a paid community hands people
something they never bought. […]

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Exports

None — this file exports nothing.

## Interfaces

- **Environment variables (`process.env`):** `MONGODB_URI`, `SCRATCH_DIR`
- **Filesystem writes:** `writeFileSync(outFile)` (L97)

## Dependencies

- **Internal:** none
- **Packages:**
  - `dotenv`
  - `mongoose`
  - `fs`
  - `path`

## Used by

Entry: run by hand: `npx tsx server/scripts/backfill-channel-members.ts`.

## Notes

- ⚠ **Connects to `MONGODB_URI`** — in this project that is the **production database** (see `.env`). No write operations were detected, but check the code before running.
- Command-line flags referenced: `--apply`, `--all-users`, `--channel`.
