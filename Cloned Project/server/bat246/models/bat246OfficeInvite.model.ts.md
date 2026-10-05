# `server/bat246/models/bat246OfficeInvite.model.ts`

> Mongoose model, keyed by email, that remembers who invited a brand-new prospect to become a BAT246 Distributor, so the referral can still be credited later.

**Kind:** BAT246 game module (backend) — Mongoose model · **Lines:** 28

## Purpose
On the Inviteandplace page, "+ Invite to become Bat246 Distributor" emails someone who may not have a Garage account yet. Their referral normally travels in the link's `bat246Ref` parameter. If the prospect closes the browser mid-signup and returns later through a link without that parameter, the referral would be lost. This collection is the durable fallback that the signup and checkout steps consult in that case.

## How it works
Fields (`timestamps: true`):
- `email`: required, **unique**, lower-cased, trimmed.
- `inviterUserId` (→ `User`, required).
- `productId` (→ `Product`, required): the entry product they were invited to buy.

Rows are upserted, not appended, so the most recent invite for an email replaces the earlier one:
- `POST /bat246/office-invite` in `bat246.routes.ts` calls `findOneAndUpdate` with upsert when it sends the email. A failure is logged and does not block the email.
- `resolveBat246Ref()` in `bat246.service.ts` calls `findOne` by email when a request carries no explicit `bat246Ref`.

## Exports
- `Bat246OfficeInvite` - Mongoose model registered as `"bat246OfficeInvites"`.

## Interfaces
- **Database:** collection `bat246officeinvites`.
- **Endpoints using it:**
  - `POST /backend/bat246/office-invite` (`requireAuth`) writes it.
  - `POST /backend/bat246/claim-invite` reads it indirectly, through `resolveBat246Ref`.

## Dependencies
- **Packages:** `mongoose`.

## Used by
- `server/bat246/routes/bat246.routes.ts`
- `server/bat246/services/bat246.service.ts`

## Notes
- This record holds the latest invite, but the referral that actually sticks is the first one written to `Bat246Distributor.bat246RefUserId`, because that write uses `$setOnInsert`. A later invite changes this record but not an attribution already stored.
