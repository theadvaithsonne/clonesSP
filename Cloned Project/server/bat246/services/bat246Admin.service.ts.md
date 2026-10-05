# `server/bat246/services/bat246Admin.service.ts`

> Super-admin BAT246 board operations: create a new board pre-filled with the eight house slot-holder accounts, search qualified distributors, assign a user to a slot, activate a pending board, and promote Dugout players into empty AT BAT slots.

**Kind:** BAT246 game module (backend) - service · **Lines:** 486

## Purpose
Most BAT246 placements are driven by purchases, invites and upline approvals (`bat246.service.ts`, `bat246Entry.service.ts`). This file holds the manual back-office tools the admin (Alan K) uses from the board setup UI: spinning up a fresh board, hand-assigning slots, and fixing a stuck Dugout. It is called only through `server/bat246/controllers/bat246.controller.ts`.

## How it works

### Board creation - `createBoard(adminUserId)` (L74-L159)
- Only the hardcoded Alan K email (L26) may create a board; otherwise it throws "Only the admin can create boards" (the controller maps that to HTTP 403).
- Loads the eight fixed slot-holder users listed in `SLOT_EMAILS` (L50-L59, house test accounts for Home Plate, 3rd, 2nd A/B and 1st A-D). If any is missing it throws, telling the operator to run the `setupBat246Slots` script first.
- Finds or creates a `Bat246Player` for each, sequentially so `createBat246Player` never hands out duplicate player numbers.
- Atomically increments `boardCounter` and `familyCounter` on the singleton `Bat246Config` (upserted). The family's starting sequence is 1000 unless `familySequences[familyNumber]` was pre-seeded, and the tracking number becomes `<familyNumber>-<startSeq>`.
- Creates the board as **active** (not pending) with: 120-hour protection period, `minorLeagueAmount` 650, `nextHomePlatePayout` 200, generation 0, eight empty AT BAT slots, and empty Grand Slam / Home Run / Triple leaderboard rows. Slot entry numbers are `"1"`..`"8"` by position index, country origin via `resolveCountryOrigin`.
- Reserves the board's POD team number (`assignPodTeamId`) and upserts `Bat246PlayerBoard` membership rows (`homePlate`, `thirdBase`, ..., `firstBase.A`..`firstBase.D`).

### User search - `searchGarageUsers(query)` (L161-L192)
Returns up to 100 users who have a `Bat246Distributor` with `isQualified: true`, optionally filtered by a case-insensitive regex on name, email or phone. The query is escaped with `escapeRegex` so user input cannot break or widen the regex. (The doc comment still says "at most 20".)

### Slot assignment - `assignSlot(boardId, position, garageUserId)` (L194-L293)
Works on `pending` or `active` boards. Builds a slot for the user (finding or creating their player) and `$set`s it at `thirdBase`, `secondBaseA/B`, `firstBase.<i>` or `atBat.<i>`. Side effects, each non-fatal:
- adds the user as `member` of the organization that owns the product tagged `bat246_entry`, so the game appears in their sidebar;
- upserts their `Bat246Distributor` with `isOfficeMember: true` and `playerId` (other qualification flags default to false on insert);
- upserts the `Bat246PlayerBoard` membership.
No Green Card, wallet transfer or split check is performed.

### Activation - `activateBoard(boardId, nextHomePlatePayout?)` (L295-L313)
Only for `pending` boards with a Home Plate occupant. Sets status `active`, restarts the 120-hour protection period and optionally overrides `nextHomePlatePayout`. The doc comment says all eight upper slots must be filled, but the code only checks Home Plate.

### Pending board read - `getPendingBoard(boardId)` (L315-L320)
Returns the board only if its status is `pending`.

### Dugout promotion - `promoteDugoutToAtBat(boardId)` (L324-L485)
Loops until either the Dugout or the empty AT BAT slots run out. For each step it re-reads the board, moves the first Dugout entry into the first empty AT BAT slot (`$set` + `$pull` by `playerId`), and awards a card to the player recorded in `referredBy`:
- referrer on 2nd Base A/B or 3rd Base: `blackCards + 1`, `cardType: "Black"` if no card yet;
- referrer on Home Plate: `brownCards + 1`, `cardType: "Brown"` if none.
The earner gets a hotBox entry, `minorLeague.cardsEarned.black|brown` incremented, a trophy check, and a `Bat246SalesCredit` row (card back built with `buildGoldCardBack`, `countsForLB: true`). The player's `Bat246PlayerBoard` position becomes `atBat.<i>`, and the AT BAT wallet transfers to Home Plate and 3rd Base fire (errors logged). After the loop, if all 8 AT BAT slots are filled on an active board it lazily `require`s `bat246Split.service` and fires `splitBoardPhase1`. Returns `{ moved, splitTriggered }`.

## Exports
- `createBoard(adminUserId: string)` - create a new active board (admin only).
- `searchGarageUsers(query: string)` - `{ userId, name, email, profilePicture, country }[]` of qualified distributors.
- `assignSlot(boardId, position: AssignablePosition, garageUserId): Promise<void>` - put a user in a slot.
- `activateBoard(boardId, nextHomePlatePayout?): Promise<void>` - pending -> active.
- `getPendingBoard(boardId)` - pending board or null.
- `promoteDugoutToAtBat(boardId): Promise<{ moved: number; splitTriggered: boolean }>` - Dugout -> AT BAT fixer.
- `type AssignablePosition` - union of the 15 assignable position keys (3rd, 2nd A/B, 1st A-D, atBat-0..7).

## Interfaces
- **Endpoints served (via `bat246.controller.ts` and `server/bat246/routes/bat246.routes.ts`, mounted at `/bat246`, browser `/backend/bat246`):** `POST /boards` (`createBoard`), `GET /users/search?q=` (`searchGarageUsers`), `POST /boards/:id/assign` (`assignSlot`), `POST /boards/:id/activate` (`activateBoard`), `POST /boards/:id/fix-dugout` (`promoteDugoutToAtBat`). All use `requireAuth`.
- **Database:** `Bat246Board`, `Bat246Player`, `Bat246PlayerBoard`, `Bat246SalesCredit`, `Bat246Distributor`, `Bat246Config` (counters) - read/write; `User` - read and organization membership write; `Product` - read.
- **Background work:** fire-and-forget trophy checks, wallet transfers and split trigger.

## Dependencies
- **Internal:** `../models/bat246Board|Player|PlayerBoard|SalesCredit|Distributor|Config.model`; `./bat246PlayerId.util` (`createBat246Player`); `./bat246Country.util` (`resolveCountryOrigin`); `./bat246Trophy.service` (`checkAndAwardTrophiesByCards`); `./bat246Wallet.util` (AT BAT transfers); `./bat246CardBack.util` (`buildGoldCardBack`); `./bat246PodInvite.service` (`assignPodTeamId`); `./bat246Split.service` (lazy `require`); `../../models/user.model`, `../../models/product.model`; `../../utils/userSearchClauses` (`escapeRegex`).
- **Packages:** `mongoose` - `Types.ObjectId`.

## Used by
`server/bat246/controllers/bat246.controller.ts` and the test `server/bat246/__tests__/bat246Admin.service.test.ts`.

## Notes
- Only `createBoard` checks the admin identity inside the service. `assignSlot`, `activateBoard` and `promoteDugoutToAtBat` trust the caller, and the controller handlers seen for them do no admin check either (routes only apply `requireAuth`). Any extra gate would have to be upstream; confirm before relying on it.
- The admin email and the eight slot-holder emails are hardcoded identifiers (not secrets).
- Bug: in `assignSlot` the `Bat246PlayerBoard` row is upserted before the "is this a fresh slot?" lookup, so `existing` is always found and `minorLeague.totalEntries` is never incremented there.
- Re-assigning a slot overwrites the previous occupant without cleaning up their `Bat246PlayerBoard` row.
- Dugout promotion cards are stored with `buildGoldCardBack` even though the card type is Black/Brown.
