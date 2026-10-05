# `server/bat246/models/bat246TopTen.model.ts`

> Mongoose model for a precomputed BAT246 "Top Ten" ranking: one document per (category, period) pair.

**Kind:** BAT246 game module (backend) — Mongoose model · **Lines:** 30

## Purpose
This model defines storage for cached leaderboard rankings. Each document holds the ranked list of players for one of 11 categories in one of 8 periods (A-H), plus when it was computed. In the current codebase, the only reference to it outside this file is the BAT246 backup/wipe script. No service or route reads or writes it.

## How it works
- `RankingEntrySchema` (embedded, no `_id`) has four fields, all required:
  - `rank`
  - `playerId` (ref `bat246Players`)
  - `value`: the measured quantity
  - `points`
- `Bat246TopTenSchema`:
  - `category`: a number from 1 to 11, required.
  - `period`: one of `"A"`…`"H"`, required.
  - `rankings`: an array of entries, default `[]`.
  - `computedAt`: required.
  - `timestamps: false`.
- A unique index on `{category, period}` allows only one ranking document per pair.

## Exports
- `Bat246TopTen` — Mongoose model `bat246TopTen`.

## Interfaces
- **Database:** `Bat246TopTen` (collection `bat246toptens`, Mongoose's default plural).

## Dependencies
- **Packages:** `mongoose` - schema and model.

## Used by
- `server/bat246/scripts/backupAndWipeBat246.ts` is the only importer. That manual script backs up and wipes BAT246 collections, and it runs against the production database.

## Notes
- No code writes to this model and nothing reads from it except the backup script, so it is effectively dead. The leaderboard itself is computed elsewhere in the BAT246 services. What categories 1-11 and periods A-H mean is not defined in this file.
