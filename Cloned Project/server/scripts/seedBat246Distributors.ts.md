# `server/scripts/seedBat246Distributors.ts`

> Seeds 7 demo BAT246 qualified distributors (Bat246-1 through Bat246-7).

**Kind:** backend one-off script (may write to the production DB) · **Lines:** 84

<!-- docgen:auto -->

## Purpose
Seeds 7 demo BAT246 qualified distributors (Bat246-1 through Bat246-7).
Run: npx tsx src/scripts/seedBat246Distributors.ts

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Exports

None — this file exports nothing.

## Interfaces

- **Database (Mongoose models used):**
  - `User` (server/models/user.model.ts) — reads: `findOne`; **writes:** `create`
  - `Bat246Player` (server/bat246/models/bat246Player.model.ts) — reads: `findOne`, `countDocuments`; **writes:** `create`
  - `Bat246Distributor` (server/bat246/models/bat246Distributor.model.ts) — **writes:** `updateOne`
- **Environment variables (`process.env`):** `MONGODB_URI`

## Dependencies

- **Internal:**
  - `server/models/user.model.ts` — `User`
  - `server/services/signupOffer.ts` — `setSignupOffersEnabled`
  - `server/bat246/models/bat246Distributor.model.ts` — `Bat246Distributor`
  - `server/bat246/models/bat246Player.model.ts` — `Bat246Player`
- **Packages:**
  - `mongoose`
  - `dotenv`

## Used by

Entry: run by hand: `npx tsx server/scripts/seedBat246Distributors.ts`.

## Notes

- ⚠ **Connects to `MONGODB_URI`** — in this project that is the **production database** (see `.env`). It performs write operations: `User` (create); `Bat246Player` (create); `Bat246Distributor` (updateOne).
