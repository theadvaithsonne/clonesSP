# `server/bat246/routes/bat246Profile.routes.ts`

> Express router that reads and saves the BAT246-only "Country of Birth" profile field on the caller's `Bat246Distributor` record.

**Kind:** BAT246 game module (backend) — Express router · **Lines:** 50 · **Mounted at:** `/bat246/profile` (browser: `/backend/bat246/profile`)

## Purpose
On BAT246 pages (URLs starting with `/games/bat246`), the shared Complete Profile popover (`components/shared/ProfilePopover.tsx`) shows an extra "Country of Birth" field. That value is deliberately stored on the BAT246 distributor document, not on the shared `User` document, so it stays separate from the rest of Garage. The file's comment points to `bat246Distributor.model.ts` for the reasoning.

## How it works
- `GET /country-of-birth` (`requireAuth`): loads the caller's `Bat246Distributor` by `userId`, selects only `countryOfBirth`, and returns `{ success: true, countryOfBirth }`. If there is no record or no value, it returns `""`.
- `PUT /country-of-birth` (`requireAuth`), body `{ countryOfBirth }`:
  - Returns 400 if the value is missing or blank.
  - Otherwise runs `updateOne({ userId }, { $set: { countryOfBirth: trimmed } }, { upsert: true })`.
  - Brand-new users usually have no distributor document yet, because that is normally created at first purchase. The upsert creates one here.
- Errors return `500 { success: false, error }`.

## Exports
- `default` — the Express `Router`.

## Interfaces
- **Endpoints served:** `GET` and `PUT /backend/bat246/profile/country-of-birth`. Both need a Bearer JWT.
- **Database:** `Bat246Distributor` (collection `bat246distributors`): reads, and updates/upserts `countryOfBirth`.

## Dependencies
- **Internal:** `server/bat246/models/bat246Distributor.model.ts`, `server/middleware/auth.ts` (`requireAuth`).
- **Packages:** `express` (Router), `mongoose` (`Types.ObjectId`).

## Used by
- Mounted in `server/app.ts` with `app.use("/bat246/profile", bat246ProfileRoutes)`.
- Frontend: `components/shared/ProfilePopover.tsx`.

## Notes
- The upsert can create a `Bat246Distributor` that contains only `userId` and `countryOfBirth`. Other code must not assume every distributor document came from a purchase.
