# `server/bat246/scripts/migrateTrackingNumbers.ts`

> One-off migration that renames four BAT246 board tracking numbers to the `{family}-{sequence}` format and resets the family counters in `Bat246Config`.

**Kind:** backend one-off script (writes to the production DB) · **Lines:** 74

## Purpose
BAT246 boards carry a human-readable `trackingNumber`. The scheme changed from a global counter (`1-2000`, `1-2002 L`, ...) to per-family sequences starting at 100 (`1-100`, `1-101 L`, `1-102 R`, `2-100`), with a separate `familyNumber` field. This script moved the boards that existed at the time onto the new scheme and set the config counters so newly created boards continue the sequences correctly.

## How it works
1. `dotenv.config()`, connect to `MONGODB_URI` (fallback `mongodb://localhost:27017/garage`). **Production database in this project.**
2. For each entry in `MIGRATIONS` runs `Bat246Board.updateOne({ trackingNumber: old }, { $set: { trackingNumber: new, familyNumber } })`:

| Old | New | familyNumber |
|---|---|---|
| `1-2000` | `1-100` | 1 |
| `1-2002 L` | `1-101 L` | 1 |
| `1-2003 R` | `1-102 R` | 1 |
| `1-2004` | `2-100` | 2 |

   A board that is not found is logged as `SKIP`.
3. Upserts the single `Bat246Config` document with `familyCounter: 2` and `familySequences: { "1": 102, "2": 100 }` (the last sequence used in each family).
4. Disconnects. Errors exit with code 1.

## Exports
None.

## Interfaces
- **Database:**
  - `Bat246Board` (collection `bat246boards`) - update `trackingNumber` and `familyNumber`.
  - `Bat246Config` (collection `bat246configs`) - upsert the counters.
- **Environment variables:** `MONGODB_URI` - connection string (production).

## Dependencies
- **Internal:** `server/bat246/models/bat246Board.model.ts`, `server/bat246/models/bat246Config.model.ts`.
- **Packages:** `mongoose`, `dotenv`.

## Used by
Not imported anywhere. Run by hand, e.g. `npx tsx server/bat246/scripts/migrateTrackingNumbers.ts` (header shows the old `src/...` ts-node path).

## Notes
- **Do not re-run on current data.** The board renames are harmless if the old numbers are gone, but the config update is unconditional: it would reset `familyCounter` and `familySequences` to the 2-family state and make the game reuse tracking numbers that already exist.
- `bat246Split.service.ts` now derives the family prefix from the `familyNumber` field rather than parsing `trackingNumber`, precisely because scripts like this one have rewritten tracking numbers directly.
