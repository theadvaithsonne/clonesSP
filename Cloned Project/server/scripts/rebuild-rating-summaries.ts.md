# `server/scripts/rebuild-rating-summaries.ts`

> Rebuild RatingSummary rows and Review vote counters from source.

**Kind:** backend one-off script (may write to the production DB) · **Lines:** 175

<!-- docgen:auto -->

## Purpose
Rebuild RatingSummary rows and Review vote counters from source.

The review write path keeps both in sync inside a transaction, so this is a
repair/verification tool rather than a one-time migration. Run it:

  - after seeding or importing reviews out of band,
  - after changing REVIEW_AVERAGE_EXCLUDES_OWNER (the flag changes what
    counts toward every average, so every summary must be recomputed),
  - any time a summary is suspected of drifting.

Both rebuilds read from source (Review for summaries, ReviewVote for vote
counters) and overwrite, so the script is idempotent and safe to re-run.

Safety: dry-run by default — reports what WOULD change without writing.
Pass --apply to write.
 […]

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Exports

None — this file exports nothing.

## Interfaces

- **Database (Mongoose models used):**
  - `Review` (server/models/review.model.ts) — reads: `aggregate`, `find`
  - `RatingSummary` (server/models/ratingSummary.model.ts) — reads: `find`, `findOne`
- **Environment variables (`process.env`):** `MONGODB_URI`

## Dependencies

- **Internal:**
  - `server/models/review.model.ts` — `Review`, `ReviewTargetType`
  - `server/models/ratingSummary.model.ts` — `RatingSummary`
  - `server/services/review.ts` — `recomputeRatingSummary`, `recountReviewVotes`, `REVIEW_AVERAGE_EXCLUDES_OWNER`
- **Packages:**
  - `mongoose` — `Types`
  - `dotenv`

## Used by

Entry: run by hand: `npx tsx server/scripts/rebuild-rating-summaries.ts`.

## Notes

- ⚠ **Connects to `MONGODB_URI`** — in this project that is the **production database** (see `.env`). No write operations were detected, but check the code before running.
- Command-line flags referenced: `--apply`, `--votes`.
