# `server/bat246/models/bat246Board.model.ts`

> The central BAT246 Mongoose model: one document per game board, holding the baseball-diamond slots, POD seats, card hot box, penciling and pre-pick queues, leaderboard rows, and the board's family-tree links.

**Kind:** BAT246 game module (backend) — Mongoose model · **Lines:** 196

## Purpose
BAT246 is a board game themed on baseball. A board is a tree of positions: Home Plate, 3rd Base, two 2nd Base slots, four 1st Base slots and eight AT BAT slots, plus a dugout, an on-deck circle and a three-seat "POD gondola". When a board fills, it **splits** into a left and a right child board, so boards form a family tree. Almost every BAT246 service, route, script and test reads or writes this model. The game logic lives in the services (`bat246.service.ts`, `bat246Entry.service.ts`, `bat246Split.service.ts`, `bat246PodInvite.service.ts`, and others); this file defines only the data shape.

## How it works

### Sub-schemas (all `_id: false`)
- **`SlotDataSchema`** describes one occupied position. It holds:
  - who is there: `playerId` → `bat246Players`, `entryNo`, `playerName`, `playerEmail`, `enteredAt`, `joinedBoardAt`;
  - the current `cardType` (`Gold | Black | Brown | Gray | Green | NoCard`, default `null`);
  - per-type card counters: `salesCredits`, `noCards`, `goldCards`, `blackCards`, `brownCards`, `grayCards`, plus the two gray sub-types `freeGrayCards` and `grayCard160`. The comment says the rules for awarding these two are still to be decided, so for now they are counters an admin sets;
  - `warpStatus`;
  - referral: `referredBy` → `bat246Players` and `referredByName`;
  - flags: `isCPD`, `isCompanyInvitee`, `isLayaway`, `isLayawayPlan`, plus `layawayBalance`;
  - `countryResidence` and `countryOrigin`;
  - `totalEarning`: the running revenue total on a root board's Home Plate slot;
  - `hpReferralBonusCount`: how many times a Home Plate user on a child board has earned the referral bonus (at most 2);
  - `podTeamId`: stamped on all four members of a POD cycle.
- **`PencilingEntrySchema`** — `{ playerId, targetAbSlot (AB1–AB8), expiresAt, penciledAt }`. A time-limited hold on an AT BAT slot.
- **`PrePickEntrySchema`** — `{ playerId, targetAbSlot (AB1–AB8), createdAt }`.
- **`HotBoxEntrySchema`** — `{ cardType (Gold/Black/Brown/Gray/Green), playerId, assignedAt, referredUserId }`. A card that has been awarded on the board.
- **`LeaderBoardRowSchema`** — `{ tier: "G" | "H" | "T", playerId, qualifiedAt, earningsOnBoard }`. In `bat246Player.model.ts` the tiers map to Grand Slam, Home Run and Triple.

### Board-level fields (`Bat246BoardSchema`)
- **Identity:** `boardNumber` (unique Number), `trackingNumber` (unique String), `title`.
- **`status`:** one of `pending | active | splitting | split | completed | stalled`, default `active`, indexed.
- **Visibility:**
  - `hidden` drops the board from every listing (`GET /bat246/boards`, both the user's own boards and the admin "all boards" view) and from direct `GET /bat246/boards/:id` lookups, for everyone except the owner account (`ALAN_K_EMAIL`).
  - `mode` is `"live"` (default) or `"test"`. A test board is served only to a frontend running at `http://localhost:3000`, which is decided from the request's Origin or Referer by `isLocalFrontend()`.
- **Family tree:** `generation`, `familyNumber`, `side` (`left | right | null`), and links to other boards: `parentBoardId`, `leftChildBoardId`, `rightChildBoardId`. Also `splitAt` and `inviteProductId` (String).
- **Protection Period (PP):** `protectionPeriodEnd` is required. While the PP clock is paused, `ppPausedRemainingMs` holds the remaining milliseconds and `protectionPeriodEnd` is parked 10 years in the future; `null` means the clock is running.
- **Economy:**
  - `warpCount` (enum 0–4);
  - `minorLeagueAmount` (default 650): the entry price;
  - `nextHomePlatePayout` (default 200): the per-referral payout for Home Plate users on child boards.
- **POD cycle:** `pod` (array of `SlotDataSchema`, default `[]`), `podTeamId` (indexed), `podEarnerPlayerId`, `podCompletedAt`. A cycle is four placements that share one `podTeamId` (for example `P-1001`, issued from `Bat246Config.podTeamCounter`):
  - Entrants 1–3 take the `pod[]` seats.
  - Entrant 4 never takes a seat. While PP is active, entrant 4 goes to `dugout`. After PP expires, `promoteDugoutAfterPP()` in `bat246Entry.service.ts` promotes them to AT BAT and skips the $650 card side effects for slots tagged with a `podTeamId`.
  - If PP has already expired when entrant 4 is placed, `placeUserInPod()` in `bat246PodInvite.service.ts` promotes or splits at once.
  - `podEarnerPlayerId` is whoever placed entrant 4; that player earns a Gray/$160 card. `podCompletedAt` is when the cycle closed.
  - None of the POD fields are copied to child boards on a split.
- **Diamond positions:**
  - `homePlate`, `thirdBase`, `secondBaseA`, `secondBaseB`: a single slot each, default `null`;
  - `firstBase`: 4 slots, default four `null`s;
  - `atBat`: 8 slots, default eight `null`s;
  - `dugout` and `onDeckCircle`: open-ended arrays.
- **Queues:** `hotBox`, `penciling`, `prePick`, `leaderBoard`.

### Options and indexes
- `{ timestamps: true, optimisticConcurrency: true }`. With optimistic concurrency on, `save()` throws a `VersionError` if the document changed after it was loaded, so concurrent edits to one board fail loudly instead of overwriting each other.
- Indexes: `{ status: 1, createdAt: 1 }`, `{ parentBoardId: 1 }`, plus the unique and single-field indexes declared inline.

## Exports
- `Bat246Board` - Mongoose model registered as `"bat246Boards"`. Other BAT246 schemas reference boards with `ref: "bat246Boards"`.

## Interfaces
- **Database:** collection `bat246boards`. BAT246 services, controllers, routes, maintenance scripts and tests read and write it heavily.

## Dependencies
- **Packages:** `mongoose`.

## Used by
`server/bat246/__tests__/bat246.service.test.ts`, `server/bat246/__tests__/bat246Admin.service.test.ts`, `server/bat246/controllers/bat246.controller.ts`, `server/bat246/routes/bat246.routes.ts`, `server/bat246/routes/bat246Permission.routes.ts`, `server/bat246/scripts/backupAndWipeBat246.ts`, `server/bat246/scripts/fixChildBoardInviteProductId.ts`, `server/bat246/scripts/fixDugoutPromotion.ts`, `server/bat246/scripts/fixMissingAB8Entry.ts`, `server/bat246/scripts/migrateTrackingNumbers.ts`, `server/bat246/scripts/runSplitPhase2.ts`, `server/bat246/scripts/seedBat246.ts`, `server/bat246/scripts/seedBat246Product.ts`, `server/bat246/scripts/seedBat246ProductForOrg.ts`, `server/bat246/scripts/seedLbDemo.ts`, `server/bat246/services/bat246.service.ts`, `bat246Admin.service.ts`, `bat246BoardInvite.service.ts`, `bat246Entry.service.ts`, `bat246Layaway.service.ts`, `bat246Leaderboard.service.ts`, `bat246PodInvite.service.ts`, `bat246Split.service.ts`, `bat246Trophy.service.ts`, `bat246Wallet.util.ts`, and 11 more. HTTP traffic reaches it through the `/bat246` routers mounted in `server/app.ts` (browser: `/backend/bat246/...`).

## Notes
- **Keep `pod`'s default as `[]`.** The in-code comment explains that `[null, null, null]` broke Mongoose's DocumentArray hydration and made **any** `save()` throw a `ValidationError` on boards created before the field existed (a real crash on 2026-08-05). `placeUserInPod()` and `getMyActivePodBoards()` already handle a short or empty array.
- `firstBase` and `atBat` still default to arrays of `null`s, which is the same pattern. The comment does not report a problem with them, but bear it in mind when touching these defaults.
- The comment says `isLocalFrontend()` lives in `bat246.service.ts`. It is actually defined in `server/bat246/services/bat246TestMode.ts`.
- `SlotDataSchema.salesCredits` holds the counter for the green-circle card. The user-facing product term is "Green Card", not "Sales Credit".
- Several other models (`bat246PendingPlacement`, `bat246PlacementNotifications`, `bat246PositionReservations`) reference this model as `ref: "Bat246Board"`, which does not match the registered name `"bat246Boards"`. `populate()` on those fields would fail.
