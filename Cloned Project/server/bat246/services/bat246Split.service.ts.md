# `server/bat246/services/bat246Split.service.ts`

> Splits a full BAT246 board into a left and a right child board: a MongoDB transaction for the structural change, then an asynchronous second pass for movement history, memberships and leaderboard graduation.

**Kind:** BAT246 game module (backend) — service · **Lines:** 472

## Purpose
When all 8 AT BAT slots on a BAT246 board are filled, the board "splits".
- Every player moves up one row onto one of two new child boards.
- The 3rd Base player becomes Home Plate on both children.
- The parent's Home Plate player leaves the tree, which counts as "crossing home plate" and qualifies them for leaderboards.

This file is the only implementation of a split. Entry, admin and POD placement code call it whenever AT BAT fills up, and it can also be triggered manually through an endpoint.

## How it works

### `buildChildHotBox` (L8-L28)
This private helper keeps only the parent's `hotBox` entries whose `referredUserId` lands on the given child board, counting positions and dugout. Entries with no `referredUserId` (older records) are dropped.

### Phase 1: `splitBoardPhase1(parentBoardId)` (L30-L362)
Everything runs inside a single `mongoose.startSession()` transaction.

1. **Load the parent.** It loads the parent, which must have `status: "active"`, and remembers its `__v`.
2. **Family numbering.**
   - The family prefix comes from the `familyNumber` field. Only legacy boards fall back to parsing `trackingNumber` (`"<family>-<seq>..."`), and the code logs a warning if the two disagree.
   - It scans every board in the family for the highest sequence number in use and seeds `Bat246Config.familySequences.<family>` with `$max`.
   - It then runs `$inc boardCounter: 2` and `familySequences.<family>: 2`. The left child gets the even sequence and the right child the odd one; the code asserts that parity.
   - It also checks that neither sequence number is already used in the family. Any failure aborts the split.
3. **Lock the parent.** It runs `findOneAndUpdate({ _id, __v, status: "active" })`, setting `status: "splitting"` and incrementing `__v`. If that matches nothing, it throws "Concurrent split detected — retry". The controller maps that error to HTTP 409.
4. **Build the children.**
   - **Slots.** `copySlot` copies each slot with a new `enteredAt` and keeps `entryNo` (a split is not a purchase) and any `podTeamId`.
   - **Leaderboard.** The parent's G/H/T occupants are copied onto both children, each with `earningsOnBoard: 0`.
   - **Dugout routing:**
     - a slot tagged with `podTeamId` follows its `referredBy` to whichever side that player is on, and defaults to the right;
     - otherwise `dugout[0]` goes left and `dugout[1]` goes right;
     - entries at index 2 and beyond follow `referredBy`, defaulting to the right.
   - **POD history.** The parent's `pod[]`, `podTeamId`, earner and completion fields are not copied.
5. **Create the left board.**
   - Tracking number `"<family>-<even> L"`, `side: "left"`, `generation + 1`.
   - Protection period: 120 hours (5 days).
   - `inviteProductId`, `minorLeagueAmount` and `nextHomePlatePayout` (default 200) are copied from the parent; `warpCount: 0`.
   - Slot moves: parent `thirdBase` → `homePlate`, `secondBaseA` → `thirdBase`, `firstBase[0..1]` → `secondBaseA`/`secondBaseB`, `atBat[0..3]` → `firstBase[0..3]`.
   - `atBat` starts empty. `penciling` and `prePick` are empty.
6. **Create the right board.** The same, mirrored: `secondBaseB` → `thirdBase`, `firstBase[2..3]` → the second bases, `atBat[4..7]` → first base, tracking number `"... R"`.
7. **Reserve POD team ids.** For each child, it calls `assignPodTeamId(child, session)` and saves the child. The call must pass the session, because the transaction already holds the config document and an outside `$inc` would deadlock.
8. **Finalize the parent.** It sets `status: "split"`, `splitAt`, `leftChildBoardId` and `rightChildBoardId`, and commits.
9. **Start phase 2.** It fires `runPhase2` without awaiting it and returns `{ parentId, leftBoardId, rightBoardId, leftBoardNumber, rightBoardNumber }`. Any error aborts the transaction and is rethrown.

### Phase 2: `runPhase2` (private, L364-L471)
These steps run outside the transaction:
1. **Movement history.** It reads both children and, for every occupied slot including the dugout and on-deck circle, inserts a `Bat246Movement` record with `reason: "split"`.
2. **Close old memberships.** It marks those players' active `Bat246PlayerBoard` rows on the parent as `status: "left"` with `leftAt`.
3. **Open new memberships.** It upserts an active membership row per child board and position, using `$setOnInsert`.
4. **Graduate the old Home Plate.** It sets `minorLeague.crossedHp` and `crossedHpAt` on the parent's Home Plate player, then calls `assignLbSlots(childId, parentHpId)` from `bat246Leaderboard.service.ts` for each child.

The comments say the later steps (matching bonus, free entries, loans, layaway, TopTen) are still stubs.

## Exports
- `splitBoardPhase1(parentBoardId: string): Promise<{ parentId, leftBoardId, rightBoardId, leftBoardNumber, rightBoardNumber }>` — performs the split. Throws if the board is not active, on a concurrent split, or on a sequence parity or collision problem.

## Interfaces
- **Endpoints served (indirectly):** `POST /backend/bat246/boards/:id/split` (`requireAuth`), handled by `ctrl.triggerSplit` in `bat246.controller.ts`. Concurrency errors return 409; other errors return 400.
- **Database:**
  - Reads, creates and updates `Bat246Board` (model `bat246Boards`).
  - Updates `Bat246Config` (`boardCounter`, `familySequences`, and `podTeamCounter` through `assignPodTeamId`).
  - Inserts `Bat246Movement` rows.
  - Updates and upserts `Bat246PlayerBoard` rows.
  - Updates `Bat246Player.minorLeague`.
- **Background work:** phase 2 runs as an unawaited promise after commit.

## Dependencies
- **Internal:**
  - BAT246 models: `bat246Config`, `bat246Board`, `bat246Player`, `bat246PlayerBoard`, `bat246Movement`.
  - `bat246PodInvite.service.ts` (`assignPodTeamId`, dynamically imported).
  - `bat246Leaderboard.service.ts` (`assignLbSlots`, loaded with `require()` to avoid an import cycle).
- **Packages:** `mongoose` (sessions and transactions, `Types`). Transactions need MongoDB running as a replica set.

## Used by
- `server/bat246/controllers/bat246.controller.ts`, which serves the manual split endpoint.
- `server/bat246/services/bat246.service.ts`, `bat246Admin.service.ts` and `bat246Entry.service.ts`, which split automatically when AT BAT is full.
- `server/bat246/services/bat246PodInvite.service.ts`, after a fourth POD entrant lands in AT BAT.
- `server/bat246/scripts/triggerSplit.ts`, a manual script with a hardcoded board id. It connects to `MONGODB_URI` (production in this project) and really splits that board.

## Notes
- **A phase 2 failure is not retried.** Phase 2 is fire-and-forget. If it fails, for example because the process restarts, movements, memberships and HP graduation are missing, and nothing retries them automatically.
- **One player sits on both children.** The 3rd Base player becomes Home Plate on both child boards, so they can earn on both.
- **There is no AT BAT guard here.** The function does not itself check that AT BAT is full; it trusts its callers.
