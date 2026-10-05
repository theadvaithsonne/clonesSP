# `server/scripts/set-test-webinar-thumbnail.ts`

> One-off: sets the "test" BAT246 webinar's thumbnail to the BAT246 Player ID card image.

**Kind:** backend one-off script (may write to the production DB) · **Lines:** 35

<!-- docgen:auto -->

## Purpose
One-off: sets the "test" BAT246 webinar's thumbnail to the BAT246 Player
ID card image. Its previous thumbnail was empty ("") so the pre-join card
fell back to hostProfilePicture (Alan's photo) — see
SessionNotStartedCard.tsx:224 `coverPhoto || hostProfilePicture || orgIcon`
and publicWebinar.ts's /validate response `coverPhoto: workshop.thumbnail`.
Setting a real thumbnail makes it win over that fallback for every normal
visitor who reaches the pre-join screen (not just the "05" demo path).

Run: npx ts-node src/scripts/set-test-webinar-thumbnail.ts

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Exports

None — this file exports nothing.

## Interfaces

- **Raw collections:** `workshops`
- **Environment variables (`process.env`):** `MONGODB_URI`
- **External hosts mentioned in the code:** `nela-app.s3.us-east-1.amazonaws.com`

## Dependencies

- **Internal:** none
- **Packages:**
  - `mongoose`
  - `dotenv`

## Used by

Entry: run by hand: `npx tsx server/scripts/set-test-webinar-thumbnail.ts`.

## Notes

- ⚠ **Connects to `MONGODB_URI`** — in this project that is the **production database** (see `.env`). No write operations were detected, but check the code before running.
