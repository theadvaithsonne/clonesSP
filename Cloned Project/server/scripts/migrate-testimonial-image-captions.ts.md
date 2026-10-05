# `server/scripts/migrate-testimonial-image-captions.ts`

> One-off migration: converts every Bat246 Lost Money testimonial's `images` field from the old shape (`string[]` of URLs) to the new one (`{ url, caption }[]`), which is what bat246LostMoneyTestimonial.model.ts now expects.

**Kind:** backend one-off script (may write to the production DB) · **Lines:** 74

<!-- docgen:auto -->

## Purpose
One-off migration: converts every Bat246 Lost Money testimonial's
`images` field from the old shape (`string[]` of URLs) to the new one
(`{ url, caption }[]`), which is what bat246LostMoneyTestimonial.model.ts
now expects.

Written via the raw MongoDB driver (not the Mongoose model) on purpose:
once the model's schema is updated to the new shape, reading a document
that still has plain-string entries through that model would fail to
cast. Going around the model for this one write sidesteps that — every
document is normalized on disk before anything ever reads it through
the new schema.

Idempotent: an entry that's already `{ url, caption }` (object with a
string `url`) is left untouched, so this is safe to re-run.

Run: npx ts-node src/scripts/migrate-testimonial-image-captions.ts

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Exports

None — this file exports nothing.

## Interfaces

- **Raw collections:** `bat246lostmoneytestimonials`
- **Environment variables (`process.env`):** `MONGODB_URI`

## Dependencies

- **Internal:** none
- **Packages:**
  - `mongoose`
  - `dotenv`

## Used by

Entry: run by hand: `npx tsx server/scripts/migrate-testimonial-image-captions.ts`.

## Notes

- ⚠ **Connects to `MONGODB_URI`** — in this project that is the **production database** (see `.env`). No write operations were detected, but check the code before running.
