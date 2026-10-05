# `server/scripts/update-will-wiens-testimonial.ts`

> One-off: replaces the message text and adds 4 captioned photos to Wilhelm (Will) Wiens' testimonial on the Lost Money site, per the founder's exact replacement text and photo captions given 2026-08-28.

**Kind:** backend one-off script (may write to the production DB) · **Lines:** 84

<!-- docgen:auto -->

## Purpose
One-off: replaces the message text and adds 4 captioned photos to
Wilhelm (Will) Wiens' testimonial on the Lost Money site, per the
founder's exact replacement text and photo captions given 2026-08-28.

The 4 photos were already uploaded to S3 via POST /uploads/public
(the same public endpoint the testimonial submission form itself
uses) — this script only writes the resulting URLs + captions and the
new message onto the existing document. Nothing else on the
testimonial (name, approved, approvedAt, hidden) is touched.

Run: npx ts-node src/scripts/update-will-wiens-testimonial.ts

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Exports

None — this file exports nothing.

## Interfaces

- **Database (Mongoose models used):**
  - `Bat246LostMoneyTestimonial` (server/bat246/models/bat246LostMoneyTestimonial.model.ts) — reads: `findById`; **writes:** `updateOne`
- **Environment variables (`process.env`):** `MONGODB_URI`
- **External hosts mentioned in the code:** `nela-app.s3.us-east-1.amazonaws.com`

## Dependencies

- **Internal:**
  - `server/bat246/models/bat246LostMoneyTestimonial.model.ts` — `Bat246LostMoneyTestimonial`
- **Packages:**
  - `mongoose`
  - `dotenv`

## Used by

Entry: run by hand: `npx tsx server/scripts/update-will-wiens-testimonial.ts`.

## Notes

- ⚠ **Connects to `MONGODB_URI`** — in this project that is the **production database** (see `.env`). It performs write operations: `Bat246LostMoneyTestimonial` (updateOne).
