# `lib/admin-api/danger-zone.ts`

> Garage-admin client for destructive and override operations on users and organisations: delete previews, permanent deletes, phone removal, manual email and phone verification, and completing a profile.

**Kind:** frontend library · **Lines:** 186

## Purpose
These calls back the "danger zone" actions in the admin Users, Organizations and Companies tables. Deletes are permanent and **cascade to nothing**: neither `User` nor `Organization` has a soft-delete field, and the records that point at them (invoices, wallets, subscriptions) are intentionally kept so that financial history outlives the account. Deletes therefore use two steps: a preview shows the operator how many records will be orphaned, then a typed confirmation is sent and checked again on the server.

## How it works
All calls use `garageAdminApi`, which attaches the admin JWT and throws on any non-2xx response.

- **Delete previews.** `getUserDeletePreview` and `getOrgDeletePreview` return the target's summary plus a list of `DependentCount { label, count, capped }`, the sum `totalDependents`, `countsCapped`, and `cascades`. A count stops at 10,000 on the server; `capped` means the real number is higher. The org preview also returns `members`: how many people's embedded membership will be detached.
- **Deletes.**
  - `deleteAdminUser(userId, confirm)` sends `{ confirmEmail: confirm }`. The confirmation must match the account's email. If there is no email it must match the name, and if there is neither it must be the literal `DELETE`; the server checks whichever rule applies.
  - `deleteAdminOrganization(orgId, confirmName)` sends `{ confirmName }`, which must match the company name. It returns `membersDetached`.
- **Recoverable overrides** (no typed confirmation):
  - `removeUserPhone` clears the phone number **and** sets `phoneVerified` to false together, so an account never stays "verified" for a number it no longer has. It returns the removed number for a toast.
  - `setUserEmailVerified(userId, verified)` sets `isVerified` by hand, for bouncing mailboxes, imported records, or an address confirmed by support. It grants nothing: login still needs an OTP every time.
  - `setUserPhoneVerified(userId, verified)` sets `phoneVerified` by hand.
- **`completeUserProfile(userId, input)`** fills in name, phone and address fields. `startOfferWindow` is off by default. When true, it sets `profileCompletedAt`, which starts the user's 24-hour free-first-cycle window. Per the source comment, the server ignores it if the window was already started, so nobody gets a second window. The response reports `offerWindowStarted`.

## Exports
- `interface DependentCount` - `{ label, count, capped }`.
- `interface UserDeletePreview` - user summary (`id`, `name`, `email`, `isVerified`, `profileComplete`, `organizations`, `createdAt`) plus the dependent fields.
- `interface OrgDeletePreview` - organisation summary (`id`, `name`, `slug`, `createdAt`) plus the dependent fields and `members`.
- `getUserDeletePreview(userId)` - `GET …/users/:userId/delete-preview`.
- `deleteAdminUser(userId, confirm)` - permanent user delete.
- `getOrgDeletePreview(orgId)` - `GET …/organizations/:orgId/delete-preview`.
- `deleteAdminOrganization(orgId, confirmName)` - permanent organisation delete.
- `removeUserPhone(userId)` - clears phone and phone verification.
- `setUserEmailVerified(userId, verified)` - email-verification override.
- `setUserPhoneVerified(userId, verified)` - phone-verification override.
- `interface CompleteProfileInput` - `name?`, `phone?`, `country?`, `state?`, `city?`, `postalCode?`, `startOfferWindow?`.
- `completeUserProfile(userId, input)` - completes a user's profile and can start the offer window.

## Interfaces
- **Backend endpoints called** (served by `server/routes/garageAdminDangerZone.ts`, mounted at `/garage-admin` ahead of the general admin router so its DELETE routes are not shadowed):
  - `GET /backend/garage-admin/users/:userId/delete-preview` - user delete preview
  - `DELETE /backend/garage-admin/users/:userId` - body `{ confirmEmail }`
  - `GET /backend/garage-admin/organizations/:orgId/delete-preview` - organisation delete preview
  - `DELETE /backend/garage-admin/organizations/:orgId` - body `{ confirmName }`
  - `DELETE /backend/garage-admin/users/:userId/phone` - remove phone
  - `PATCH /backend/garage-admin/users/:userId/email-verification` - body `{ verified }`
  - `PATCH /backend/garage-admin/users/:userId/phone-verification` - body `{ verified }`
  - `PATCH /backend/garage-admin/users/:userId/complete-profile` - body `CompleteProfileInput`
- **Database (indirect):** the backend permanently deletes `User` / `Organization` documents and edits user fields. Records that point at them are left in place.

## Dependencies
- **Internal:** `lib/api.ts` - `garageAdminApi`.

## Used by
- `app/garage-admin/(admin-dashboard)/companies/page.tsx`
- `app/garage-admin/(admin-dashboard)/organizations/page.tsx`
- `app/garage-admin/(admin-dashboard)/users/page.tsx`
- `components/garage-admin/CompleteProfileDialog.tsx`
- `components/garage-admin/DangerConfirmDialog.tsx`

## Notes
- The source describes these as super-admin operations; the backend enforces that.
- The deletes cannot be undone and leave orphaned financial records. Always show the preview first.
