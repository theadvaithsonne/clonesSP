# `lib/affiliate/library-affiliate.ts`

> Fetches the affiliate identity that the admin funnel library's "general" links are authored under: the garage super admin, resolved at runtime.

**Kind:** frontend library · **Lines:** 37

## Purpose
A funnel CTA usually stores only an item's identity (`itemType`, `itemId`, `orgSlug`). The viewing affiliate's own `?ref=` is added when the funnel is shown. "General" platform links are the exception. They have no resolvable item, so the picker saves a pre-built href with an affiliate id baked in, for example `networkchains.com/register/<affiliateId>`.

Library funnels are templates that every affiliate adopts, so that baked-in id must not belong to whichever admin edited the funnel. This client asks the backend for the correct platform identity instead.

## How it works
- `fetchLibraryAffiliate()` calls the backend through `garageAdminApi` and returns `{ affiliateId, email }`. Missing fields become `null`.
- The backend (`server/routes/garageAdmin.ts`, `requireGarageAdminAuth`) works out the identity in three steps:
  1. find the `GarageAdmin` record with role `garage-super-admin`
  2. find the `User` with the same email
  3. return that user's `affiliateId`
- Because it is resolved on each call, the value follows a change of super admin or a reissued affiliate id. Hardcoding it, or keeping it in an env var, would go stale without anyone noticing.

## Exports
- `LibraryAffiliate` - `{ affiliateId: string | null; email: string | null }`.
- `fetchLibraryAffiliate(): Promise<LibraryAffiliate>`

## Interfaces
- **Backend endpoints called:** `GET /backend/garage-admin/library-affiliate` - garage-admin auth. Returns the super admin's affiliate id and email.
- **Browser storage / cookies:** `garage_admin_token` (via `garageAdminApi`).

## Dependencies
- **Internal:** `lib/api.ts` - `garageAdminApi`.

## Used by
- `app/garage-admin/(admin-dashboard)/networkchains/funnels/[id]/page.tsx` (the admin funnel editor).

## Notes
- **Invariant:** `affiliateId` is `null` when no super admin exists or that admin has no user row. In that case callers must author the link with **no** ref. They must never fall back to the signed-in admin's id, because preventing that is the whole reason this lookup exists.
