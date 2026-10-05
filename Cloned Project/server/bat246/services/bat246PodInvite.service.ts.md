# `server/bat246/services/bat246PodInvite.service.ts`

> Runs the BAT246 "POD" ($160 entry) lifecycle: who may invite, invite and reminder emails, recording purchases (which also triggers the Lost Money drip), placing purchasers onto a board's 4-person POD cycle, POD team IDs, and team lookups.

**Kind:** BAT246 game module (backend) — service · **Lines:** 664

## Purpose
POD is the cheaper ($160) way into BAT246. A qualified distributor is invited to buy the POD digital product (`POD_PRODUCT_ID`). Once they have bought it, a board member places them into that board's POD cycle:
- the first three entrants fill three visible POD seats;
- the fourth closes the cycle, lands in the Dugout or AT BAT, and earns the inviter a $160 Gray Card.

All four entrants share one team id ("P-1001", ...). This file holds all of that logic. It is used by the Distributors grid endpoints, by every checkout path that can sell the POD product, and by the board creation and split code, which reserves team ids.

## How it works

### Access gates (L13-L56)
- `POD_MEMBER_PLAYER_ID_PATHS` lists every board slot path a player can occupy: home plate, the bases, first base, AT BAT, dugout, on-deck circle and POD.
- `isAdminCaller(userId)` looks up the user's email and compares it with the hardcoded Alan K email.
- `isPartOfAnyActiveBoard(userId)` is true for the admin, or when the user's `Bat246Player` occupies any of those paths on a board with `status: "active"`.

### Invites (L58-L121)
`sendPodInvite(target, caller)`:
- **Checks.** The caller must pass `isPartOfAnyActiveBoard`. The target must have a distributor record and an email, and must not have bought POD yet.
- **Email.** It builds `podInviteEmailTemplate` with the product name and price. The price is shown in whole currency units; the code deliberately does not divide by 100. It sends the mail with `sendMail` from `EMAIL_FROM_NOTIFICATION`.
- **Log.** Every send writes a `Bat246PodInvite` row typed `"invite"` (first send) or `"remind"`. There is no cooldown.
- **Distributor update.** It updates `podInviteSentAt` and `$inc podInviteCount`. The `podInvitedBy*` fields are set only on the first send, so the first inviter keeps the credit.

### Purchase recording (L123-L261)
**`markPodPurchaseCompleted(userId)`**
- Sets `podPurchaseCompletedAt` and `podPurchaseCreditedToUserId`, which is a snapshot of `podInvitedByUserId`.
- The update is conditional on `podPurchaseCompletedAt: null`, which makes it idempotent.
- **Lost Money drip.** Only the call that actually flipped the field looks up the latest paid `Invoice` containing the POD product. It converts `totalAmount` from cents to dollars and, when that is greater than 0, fires `runLostMoneyAutoPay(saleAmount)` without awaiting it. This is the single choke point for the drip on POD sales. A 100%-off coupon yields $0, so no drip.

**`recordAutoPodInvite(userId, inviterUserId)`**
- Called when the POD was bought through the generic "+ Invite" referral link.
- Back-fills the first-touch inviter fields.
- Sets `podPurchaseCreditedToUserId` directly if the purchase was already marked. The generic hook usually runs first, while the inviter field is still empty.
- Then calls `markPodPurchaseCompleted`.

**`reconcilePodInvitedPurchases(candidateIds)`**
- A self-healing pass run on every Distributors grid load. It finds paid POD invoices for the candidate users, marks each one completed, and returns the set of user ids it completed so the caller can patch its response.

### POD team id and eligible boards (L263-L355)
- **Private helpers.** `getSlotRef` and `findCallerPosition` map a player to a named position key: `homePlate`, `thirdBase`, `secondBaseA`/`B`, `1stA`–`1stD`, `atBat-N`, `dugout` or `onDeckCircle`. `awardGrayCard160` increments `grayCard160` on the caller's slot and sets `cardType: "Gray"` if the slot has none.
- **`assignPodTeamId(board, session?)`** is a no-op if `board.podTeamId` is already set. Otherwise it runs `$inc Bat246Config.podTeamCounter` (with upsert, inside the optional session) and sets `board.podTeamId = "P-<n>"` in memory. The caller must still `save()`.
- **`getMyActivePodBoards(caller)`** returns active boards the caller sits on, or all active boards for the admin. For each it reports `podBlankCount = 4 − filled seats`, or 0 once `podCompletedAt` is set. Boards with no open places are dropped, and the list is sorted by `boardNumber`.

### Placement (L357-L579)
`placeUserInPod(target, boardId, caller)`.

**Validation.** The target's distributor must be qualified, must have bought POD, and must not be placed yet. The caller must have a player record or be the admin.

**Claim first.** The function atomically sets `podPlacedBoardId`, `podPlacedAt` and `podPlacedByUserId` with the filter `podPlacedAt: null`. If that matches nothing, it throws "just placed on another board".

**Board work.** It loads the active board; non-admins must occupy a slot on it. It rejects a board whose cycle is already complete. It finds or creates the target's `Bat246Player`, and computes `entryNo` as the count of the target's paid POD invoices, with a minimum of 1. It then calls `assignPodTeamId`.

- **Seats 1-3.** The target goes into the next empty element of `board.pod[]`, padded to 3. The slot records name, email, country of residence and origin (via `pickCountryOrigin`) and `podTeamId`. Position key: `pod-<i>`.
- **Seat 4.** This seat needs the caller's own position on the board. The new slot carries `referredBy`/`referredByName` and `podTeamId`.
  - If the board's Protection Period (`protectionPeriodEnd`) has ended and an AT BAT slot is open, the target goes straight to `atBat[i]`.
  - Otherwise the target is appended to `dugout`, to be promoted later by the normal post-Protection-Period flow.
  - Either way the caller's slot gets a $160 Gray Card, and `podEarnerPlayerId` and `podCompletedAt` are set.

**Save.** It uses `board.save()`. The Board schema has `optimisticConcurrency: true`, so a `VersionError` becomes "Something on that board just changed". The code avoids a dot-path `$set` on `pod.N`, because on legacy documents without a `pod` array that would create an object instead of an array.

**Afterwards.** It writes `podPlacedPositionKey`. If the fourth entrant went to AT BAT and all 8 AT BAT slots are now filled, it fires `splitBoardPhase1` without awaiting it.

**Rollback.** If any board-side step throws, the distributor claim is released (best effort) and the error is rethrown.

### Team lookup (L581-L663)
`getPodTeamDetails(teamId)` returns all four members:
- the three seat-holders from `pod[]` on the board that owns `podTeamId`;
- the fourth member, found by scanning any board's `dugout.podTeamId` or `atBat.podTeamId`. A split may have carried them to a child board.

For each member it adds `referredByName` from the member's distributor `podInvitedByName`.

## Exports
- `POD_PRODUCT_ID` — the ObjectId string of the $160 POD product.
- `POD_PRODUCT_URL` — the public product page URL on www.garage.app, with an affiliate ref query.
- `isAdminCaller(callerUserId): Promise<boolean>` — true if the caller is Alan K.
- `isPartOfAnyActiveBoard(callerUserId): Promise<boolean>` — the gate for POD and board invite actions.
- `sendPodInvite(targetUserId, callerUserId): Promise<{ ok: true; type: "invite" | "remind" }>` — sends the invite or reminder email.
- `markPodPurchaseCompleted(userId): Promise<void>` — idempotent purchase hook; also fires the Lost Money drip.
- `recordAutoPodInvite(userId, inviterUserId): Promise<void>` — referral-link attribution backfill.
- `reconcilePodInvitedPurchases(candidateUserIds: string[]): Promise<Set<string>>` — rebuilds purchase state from paid invoices.
- `assignPodTeamId(board, session?): Promise<void>` — reserves the board's `P-<n>` team id.
- `getMyActivePodBoards(callerUserId)` — returns `[{ _id, boardNumber, trackingNumber, podBlankCount }]`.
- `placeUserInPod(targetUserId, boardId, callerUserId)` — returns `{ ok: true, boardTrackingNumber, position }`.
- `getPodTeamDetails(teamId)` — returns `{ teamId, members: [{ playerId, playerName, entryNo, position, boardTrackingNumber, enteredAt, referredByName }] }`.

## Interfaces
- **Endpoints served (indirectly)**, through `server/bat246/routes/bat246.routes.ts`, all `requireAuth`:
  - `GET /backend/bat246/boards/my-active-pod-boards`
  - `GET /backend/bat246/my-active-board-membership`
  - `POST /backend/bat246/distributors/:userId/invite-pod`
  - `POST /backend/bat246/distributors/:userId/place-pod` (body `{ boardId }`)
  - `GET /backend/bat246/pod-team/:teamId`
  - `GET /backend/bat246/distributors` — the controller's `listDistributors` calls `reconcilePodInvitedPurchases`.
- **Database:**
  - Reads and writes `Bat246Distributor`, `Bat246Board` and `Bat246Config` (`podTeamCounter`).
  - Creates `Bat246PodInvite` and `Bat246Player` rows.
  - Reads `Invoice`, `Product` and `User`.
- **External services:** outbound email through `server/services/mailer.ts`.

## Dependencies
- **Internal:**
  - BAT246 models: `bat246Distributor`, `bat246PodInvites`, `bat246Board`, `bat246Player`, `bat246Config`.
  - `bat246PlayerId.util.ts` (`createBat246Player`).
  - `bat246Country.util.ts` (`pickCountryOrigin`).
  - `bat246LostMoneyAutoPay.service.ts` (the drip).
  - `bat246Split.service.ts` (`splitBoardPhase1`, lazily imported).
  - `server/models/user.model.ts`, `product.model.ts` and `invoice.model.ts`.
  - `server/services/mailer.ts`.
- **Packages:** `mongoose` (`Types`, `ClientSession`).

## Used by
- **Controller and routes:** `server/bat246/controllers/bat246.controller.ts`, `server/bat246/routes/bat246.routes.ts`.
- **Other BAT246 services:**
  - `bat246.service.ts`: `recordAutoPodInvite`, `isAdminCaller`, `POD_PRODUCT_ID`.
  - `bat246Admin.service.ts` and `bat246Entry.service.ts`: `assignPodTeamId`.
  - `bat246BoardInvite.service.ts`: `isPartOfAnyActiveBoard`.
  - `bat246Split.service.ts`: `assignPodTeamId` inside its transaction.
- **Checkout paths:** `server/routes/invoice.ts`, `server/routes/productCheckout.ts` and `server/services/invoice.ts` call `markPodPurchaseCompleted` in the paid, coupon-zero and free branches.

## Notes
- **Admin identity is an email comparison** against a constant on line 26.
- **Every invite click sends a real email.** Double-clicks are prevented only on the client side.
- **The seat-4 branch dereferences `callerPlayer._id`.** It throws first if `callerPosition` is null, which happens when the admin has no slot on that board. So an admin who is not seated cannot close a cycle.
- **`entryNo` for a POD seat counts POD purchases.** It is separate from the $650 entry counter `minorLeague.totalEntries`.
