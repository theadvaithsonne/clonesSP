# `server/models/pendingInvite.model.ts`

> Mongoose model that remembers "whoever signs up with this phone number or email was invited by affiliate X", so the sponsor is credited after an app-store install.

**Kind:** Mongoose model · **Lines:** 68

## Purpose
On a phone, the invite page asks the visitor for their number or email before sending them to the App Store or Play Store. The store hop drops the invite link, and on iOS nothing about the device survives reliably (the fingerprint guess in `installIntent.model.ts` is the other, weaker mechanism this backs up). The person does survive: they register in the app with the same identifier and prove it by OTP, at which point `finishLogin` finds this row and credits the sponsor.

## How it works
- **Fields:**
  - `identifier` (required, max 320) - canonical form from `server/services/identifier.ts`: lowercased email or E.164 phone.
  - `kind` - `"email"` or `"phone"`.
  - `affiliateId` (required, max 32) - sponsor's affiliate code, e.g. `aff_...`.
  - `savedAt` (required) - when the invite was last (re)written; drives the 30-day window.
  - `consumedAt` / `consumedBy` (ref `User`) - set once a verified sign-in has used the row; default `null`.
  - `timestamps: true`.
- **Trust model:** rows are unverified when written (anyone can type any number on a public page). That is safe because nothing is granted until the OTP for that same identifier is passed; the row only decides who is credited for an account its owner chose to create.
- **Last touch wins:** one live row per identifier; a new invite for the same identifier overwrites the previous one.
- **Indexes:**
  - `pending_invite_lookup`: `{ identifier: 1, consumedAt: 1, savedAt: -1 }` - finds the newest live row. The service never relies on uniqueness (production has `autoIndex` off, so indexes exist only after `indexes:sync` runs) and always sorts and takes the newest.
  - `pending_invite_ttl_45d`: TTL on `savedAt` after 45 days - housekeeping only. The 30-day window is enforced in every query, so a row that outlives it is ignored.

## Exports
- `IPendingInvite` - document interface.
- `PendingInvite` - the Mongoose model.

## Interfaces
- **Database:** `PendingInvite` (collection `pendinginvites`).

## Dependencies
- **Packages:** `mongoose`.

## Used by
- `server/services/pendingInvite.ts` - `INVITE_WINDOW_MS` (30 days), `savePendingInvite` (upsert by identifier, newest first), `lookupPendingInvite`, `pendingReferralFor`, `markPendingInviteUsed`, `allowInviteRequest` (rate limiting).

## Notes
- The 30-day rule lives in the service, not the schema; changing the TTL here does not change attribution.
