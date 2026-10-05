# `server/bat246/models/bat246LostMoneyTestimonial.model.ts`

> Mongoose model for public testimonials on the Lost Money site. Each has a name, a message and up to 10 captioned photos, and is shown only after an admin approves it.

**Kind:** BAT246 game module (backend) — Mongoose model · **Lines:** 36

## Purpose
Anyone can submit a testimonial on the Lost Money site. Submissions wait in a moderation queue until the owner (Alan K) approves them. An approved testimonial can later be hidden without deleting it. The public Paid List also links each paid person to their approved testimonial by matching names, case-insensitively.

## How it works
- **`TestimonialImageSchema`** (`_id: false`): `{ url (required, trimmed), caption (default "") }`. Photos are uploaded through `/uploads/public`. Until 2026-08-28 `images` was a plain `[String]`. Every document was migrated to the `{url, caption}` shape by `server/scripts/migrate-testimonial-image-captions.ts` before this schema went live.
- **Main schema** (`timestamps: true`):
  - `name` and `message`: required, trimmed;
  - `images`: default `[]`, up to 10 photos (the limit is applied by the route, not the schema);
  - `approved` (default `false`) and `approvedAt`;
  - `hidden` (default `false`): approved but temporarily removed from the public site.

## Exports
- `Bat246LostMoneyTestimonial` - Mongoose model registered as `"bat246LostMoneyTestimonials"`.

## Interfaces
- **Database:** collection `bat246lostmoneytestimonials`.
- **Endpoints using it** (mounted at `/bat246/lostmoney`, browser prefix `/backend/bat246/lostmoney`):
  - `GET /testimonials`: public.
  - `POST /testimonials`: public submission, with `softAuth`.
  - Admin only (`requireAuth` + `requireAlanK`): `GET /testimonials/pending`, `GET /testimonials/approved`, and `POST /testimonials/:id/approve`, `/reject`, `/hide`, `/unhide`, `/delete`.
  - `GET /paid` reads approved testimonials to attach them to Paid List rows.

## Dependencies
- **Packages:** `mongoose`.

## Used by
- `server/bat246/routes/bat246LostMoney.routes.ts`
- `server/scripts/update-will-wiens-testimonial.ts`: a one-off manual script that edits one testimonial document by id against `MONGODB_URI` (the production database).

## Notes
- Testimonials are matched to Paid List rows by exact name only, so two people with the same name will collide.
