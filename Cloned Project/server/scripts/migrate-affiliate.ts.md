# `server/scripts/migrate-affiliate.ts`

> Migration script for the native affiliate system Replaces EarnGPT third-party integration with local database

**Kind:** backend one-off script (may write to the production DB) · **Lines:** 360

<!-- docgen:auto -->

## Purpose
Migration script for the native affiliate system
Replaces EarnGPT third-party integration with local database

Run: npx ts-node src/scripts/migrate-affiliate.ts

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `migrateAffiliateSystem` | function | `async migrateAffiliateSystem(): Promise<MigrationStats>` | 359 |

## Interfaces

- **Database (Mongoose models used):**
  - `User` (server/models/user.model.ts) — reads: `find`, `findOne`
  - `Organization` (server/models/organization.model.ts) — reads: `findOne`, `find`
  - `Channel` (server/models/channel.model.ts) — reads: `countDocuments`, `findOne`; **writes:** `create`
  - `ChannelMembership` (server/models/channelMembership.model.ts) — reads: `findOne`; **writes:** `create`
- **Environment variables (`process.env`):** `MONGODB_URI`

## Dependencies

- **Internal:**
  - `server/models/user.model.ts` — `User`
  - `server/models/organization.model.ts` — `Organization`
  - `server/models/channel.model.ts` — `Channel`
  - `server/models/channelMembership.model.ts` — `ChannelMembership`
  - `server/utils/affiliateId.ts` — `generateAffiliateId`
  - `server/utils/storeSlug.ts` — `generateSlug`, `ensureUniqueSlug`
- **Packages:**
  - `mongoose`
  - `dotenv`

## Used by

Entry: run by hand: `npx tsx server/scripts/migrate-affiliate.ts`.

## Notes

- ⚠ **Connects to `MONGODB_URI`** — in this project that is the **production database** (see `.env`). It performs write operations: `Channel` (create); `ChannelMembership` (create).
