# `server/bat246/scripts/backupAndWipeBat246.ts`

> Destructive one-off script: dumps all eleven BAT246 collections to a JSON file plus a Markdown restore guide, then **deletes every document** in those collections.

**Kind:** backend one-off script (writes to and wipes production data) · **Lines:** 203

## Purpose
Used to reset the BAT246 game to an empty state while keeping a copy of what was there. It is the most dangerous script in this folder: run against `MONGODB_URI`, which in this project is the **production** database, it removes every board, player, movement, distributor record, sales credit, loan and leaderboard entry of the live game.

## How it works
**Collections handled** (`COLLECTIONS`, L31-L43): each entry pairs a label with a model.

| Label (JSON key) | Model | Mongo collection |
|---|---|---|
| `bat246Boards` | `Bat246Board` | `bat246boards` |
| `bat246Players` | `Bat246Player` | `bat246players` |
| `bat246PlayerBoards` | `Bat246PlayerBoard` | `bat246playerboards` |
| `bat246Movements` | `Bat246Movement` | `bat246movements` |
| `bat246Config` | `Bat246Config` | `bat246configs` |
| `bat246Distributors` | `Bat246Distributor` | `bat246distributors` |
| `bat246FreeEntries` | `Bat246FreeEntry` | `bat246freeentries` |
| `bat246Recruitments` | `Bat246Recruitment` | `bat246recruitments` |
| `bat246SalesCredits` | `Bat246SalesCredit` | `bat246salescredits` |
| `bat246SnapBackLoans` | `Bat246SnapBackLoan` | `bat246snapbackloans` |
| `bat246TopTen` | `Bat246TopTen` | `bat246toptens` |

(Collection names follow Mongoose's lower-case pluralisation of the model names.) Other BAT246 models in `server/bat246/models/` that are not in this list, such as the B2 coin wallet and card permissions, are neither backed up nor wiped.

**Steps:**
1. **Fetch** (L49-L58): `find({}).lean()` on every model; documents are kept in memory keyed by label, counts are logged.
2. **Choose output folder** (L60-L66): timestamp from `new Date().toISOString()` with `:` and `.` replaced. Files go to `path.resolve(__dirname, "../../../..")`. From `server/bat246/scripts` that is the folder *containing* the repo (for `D:\Cloned Project` it resolves to `D:\`), on purpose, so live player data never lands inside the project tree. Files: `bat246-backup-<timestamp>.json` and `bat246-backup-<timestamp>.md`.
3. **Write JSON** (L68-L70): the whole backup object, pretty-printed.
4. **Write the Markdown guide** (L72-L182): document counts per collection and a total; a boards table (board number, tracking number, status, generation, filled AT BAT slots out of 8, dugout size); a players table (player ID, email, nickname, `minorLeague.totalEntries`); and restore instructions. Option A embeds a complete `restoreBat246.ts` script that reads the JSON and calls `insertMany(docs, { ordered: false })` per collection; Option B is a sample `mongorestore` command for a separate dump.
5. **Wipe** (L184-L189): `deleteMany({})` on every model in the list, logging deleted counts.
6. Logs the two file paths and disconnects. Errors exit with code 1.

## Exports
None. Top-level `run()` executes on load.

## Interfaces
- **Database:** the eleven models above - read all, then delete all.
- **Environment variables:** `MONGODB_URI` - connection string (production); falls back to `mongodb://localhost:27017/garage` when unset.
- **Files written:** two backup files outside the repo folder (see step 2). They contain player emails and other personal data.

## Dependencies
- **Internal:** the eleven model files under `server/bat246/models/` that the file imports (`bat246Board`, `bat246Player`, `bat246PlayerBoard`, `bat246Movement`, `bat246Config`, `bat246Distributor`, `bat246FreeEntry`, `bat246Recruitment`, `bat246SalesCredit`, `bat246SnapBackLoan`, `bat246TopTen`).
- **Packages:** `mongoose` - queries and deletes; `dotenv` - loads `.env`; `fs` - writes backup files; `path` - builds the output path.

## Used by
Nothing imports it. Run manually, e.g. `npx tsx server/bat246/scripts/backupAndWipeBat246.ts` (header still shows the old `src/...` ts-node path).

## Notes
- **No confirmation prompt and no dry-run flag.** Running it once wipes the live game. Verify the JSON file before trusting it; the wipe runs right after the files are written, with no check that the write succeeded beyond `writeFileSync` not throwing.
- The backup is JSON via `JSON.stringify`, so `ObjectId` and `Date` values become strings. The embedded restore script inserts them as-is; Mongoose's schema casting turns most typed paths back into ObjectIds and Dates, but values in untyped/`Mixed` paths stay strings. A `mongodump` taken beforehand is a safer backup.
- The embedded restore script reads `BACKUP_FILE` relative to the working directory, and its paths/run command still refer to the old `src/bat246/scripts` layout.
- The guide's heading timestamp formatting replaces `-` by `:` after position 10, which is cosmetic only.
- The user's memory notes say earlier backup/restore files produced by this script are no longer on disk; do not assume a backup exists.
