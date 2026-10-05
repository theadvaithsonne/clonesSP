# `server/scripts/migrate-affiliate-links-itemtype.ts`

> Generalize AffiliateLink from channel-only to (itemType, itemId).

**Kind:** backend one-off script (may write to the production DB) · **Lines:** 82

<!-- docgen:auto -->

## Purpose
Generalize AffiliateLink from channel-only to (itemType, itemId).

Steps (idempotent, non-destructive to data):
  1. Backfill every legacy row → itemType: "channel", itemId: channelId,
     clickCount: 0 (where missing).
  2. Drop the legacy unique index { userId, orgId, channelId } — it would
     block product/office rows (null channelId collides).
  3. Create the new unique index { userId, orgId, itemType, itemId }.

autoIndex is ON in this app, so RUN THIS BEFORE deploying the new schema:
a deploy-first would try to build the new unique index over un-backfilled
rows (itemId undefined → duplicate-key) and silently fail.

Usage (from roam-backend/):
  npx tsx src/scripts/migrate-affiliate-links-itemtype.ts

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Exports

None — this file exports nothing.

## Interfaces

- **Raw collections:** `affiliatelinks`
- **Environment via `server/config/env.ts`:** `env.MONGODB_URI`

## Dependencies

- **Internal:**
  - `server/config/env.ts` — `env`
- **Packages:**
  - `dotenv`
  - `mongoose`

## Used by

Entry: run by hand: `npx tsx server/scripts/migrate-affiliate-links-itemtype.ts`.

## Notes

- ⚠ **Connects to `MONGODB_URI`** — in this project that is the **production database** (see `.env`). No write operations were detected, but check the code before running.
