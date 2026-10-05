# `server/bat246/models/bat246LayawayRequest.model.ts`

> Mongoose model for a three-party B2 Coins request: a requester asks an eligible user to give a stated amount of layaway coins to a recipient.

**Kind:** BAT246 game module (backend) — Mongoose model · **Lines:** 40

## Purpose
In BAT246's layaway system, only players who meet certain conditions can give B2 Coins. Anyone can ask one of them to give on someone's behalf. A request involves three people (requester, the eligible person being asked, and the recipient), which does not fit the two-party `bat246PlacementNotifications` model, so it has its own collection. The notification bell links to the request through `Bat246PlacementNotification.layawayRequestId`.

## How it works
Fields (`timestamps: true`):
- `requestedByUserId` (→ `User`, required, indexed): who asked.
- `eligibleUserId` (→ `User`, required, indexed): who is being asked to give.
- `recipientUserId` (→ `User`, required): whose wallet should receive the coins.
- `amount` (Number, required, min 0).
- `productId` (→ `Product`, default `null`): the entry product the coins are for, if any.
- `note` (default `""`).
- `status` (indexed, default `pending`), one of:
  - `pending`;
  - `approved`: the eligible user approved and `giveB2Coins()` succeeded;
  - `denied`: the eligible user said no;
  - `insufficient_at_approval`: the eligible user approved, but the give failed, for example because their remaining allowance no longer covers the amount;
  - `cancelled`: the requester withdrew while the request was still pending. Kept distinct from `denied` so the requester can tell "I changed my mind" apart from "they said no".
- `respondedAt` (Date): set on every status change away from `pending`.

Index: `{ eligibleUserId: 1, status: 1 }`, for "requests waiting for me".

Lifecycle, in `bat246Layaway.service.ts`:
- `createLayawayRequest` creates the request.
- The respond flow checks that the caller is `eligibleUserId` and that the request is still `pending`. It then denies, or calls `giveB2Coins({ requestId, ... })` and marks the request approved.
- `cancelLayawayRequest` checks that the caller is the requester.
- The service also lists a user's sent requests (by `requestedByUserId`) and received requests (by `eligibleUserId`).

## Exports
- `Bat246LayawayRequest` - Mongoose model registered as `"bat246LayawayRequests"`.

## Interfaces
- **Database:** collection `bat246layawayrequests`.
- These routes in `server/bat246/routes/bat246Layaway.routes.ts`, mounted at `/bat246/layaway`, all require `requireAuth`:
  - `POST /backend/bat246/layaway/request`
  - `POST /backend/bat246/layaway/requests/:id/respond`
  - `POST /backend/bat246/layaway/requests/:id/cancel`
  - `GET /backend/bat246/layaway/my-requests`
  - `GET /backend/bat246/layaway/requests-for-me`

## Dependencies
- **Packages:** `mongoose`.

## Used by
- `server/bat246/services/bat246Layaway.service.ts` (only importer).

## Notes
- Status changes load the request, edit it and save it, with no conditional update. Two near-simultaneous responses could both see `pending`.
- `giveB2Coins` can throw after coins have already moved (see the `source` enum issue in `bat246LostMoneyPayment.model.ts.md`). In that case the request is recorded as `insufficient_at_approval` even though the gift partly happened.
