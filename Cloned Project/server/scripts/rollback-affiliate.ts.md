# `server/scripts/rollback-affiliate.ts`

> Rollback script for the native affiliate system migration This removes the new affiliate data and restores to pre-migration state

**Kind:** backend one-off script (may write to the production DB) · **Lines:** 112

<!-- docgen:auto -->

## Purpose
Rollback script for the native affiliate system migration
This removes the new affiliate data and restores to pre-migration state

Run: npx ts-node src/scripts/rollback-affiliate.ts

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `rollbackAffiliateSystem` | function | `async rollbackAffiliateSystem()` | 111 |

## Interfaces

- **Database (Mongoose models used):**
  - `User` (server/models/user.model.ts) — **writes:** `updateMany`
  - `Organization` (server/models/organization.model.ts) — **writes:** `updateMany`
  - `Channel` (server/models/channel.model.ts) — **writes:** `deleteMany`
  - `ChannelMembership` (server/models/channelMembership.model.ts) — **writes:** `deleteMany`
- **Environment variables (`process.env`):** `MONGODB_URI`

## Dependencies

- **Internal:**
  - `server/models/user.model.ts` — `User`
  - `server/models/organization.model.ts` — `Organization`
  - `server/models/channel.model.ts` — `Channel`
  - `server/models/channelMembership.model.ts` — `ChannelMembership`
- **Packages:**
  - `mongoose`
  - `dotenv`

## Used by

Entry: run by hand: `npx tsx server/scripts/rollback-affiliate.ts`.

## Notes

- ⚠ **Connects to `MONGODB_URI`** — in this project that is the **production database** (see `.env`). It performs write operations: `User` (updateMany); `Organization` (updateMany); `Channel` (deleteMany); `ChannelMembership` (deleteMany).
