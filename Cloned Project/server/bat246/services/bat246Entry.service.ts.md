# `server/bat246/services/bat246Entry.service.ts`

> Purchase-driven BAT246 board entry: places a buyer of the BAT246 entry product onto a board according to whose invite link they used, awards the resulting cards, pays the root Home Plate / leaderboard / Lost Money flows, promotes the Dugout after the Protection Period, and triggers splits.

**Kind:** BAT246 game module (backend) - service · **Lines:** 1266

## Purpose
When someone pays for a `bat246_entry`-tagged product through any checkout path (Razorpay invoice, store wallet, NOWPayments crypto webhook, product checkout), the payment handler decides which invite context the purchase came from and calls one of the `add*` functions here. This file is the "money in -> seat on the board" half of BAT246; manual/admin placement lives in `bat246.service.ts` and board splitting in `bat246Split.service.ts`.

Board geometry used throughout: 1st Base slot `1stA..1stD` (index 0-3) "covers" AT BAT pair `[0,1]`, `[2,3]`, `[4,5]`, `[6,7]` (`POS_TO_AB`). A board splits when all 8 AT BAT slots are filled.

## How it works

### Shared helpers (L26-L148)
- `ensureGarageAppMembership(userId)` - adds the user as `stakeholder` of the parent Garage organization (`Organization` with `parent: true`) if not already a member. Called fire-and-forget by `findOrCreatePlayer`.
- `findOrCreatePlayer(userId, name, email)` - returns the existing `Bat246Player` or creates one via `createBat246Player`.
- `payLbAndCreditHp(boardId, saleAmount)` - pays leaderboard holders first (`payLbHolders`, returns the amount paid), credits the remainder to the root Home Plate (`creditRootHpUser`), then fires `runLostMoneyAutoPay(saleAmount)` (3% of the sale from Alan K's own wallet into the Lost Money queue; failures only logged).
- `creditRootHpUser(boardId, saleAmount)` (exported) - finds the generation-0 board of the same `familyNumber`, resolves its Home Plate player's Garage user, and credits their store wallet in the organization that owns the `bat246_entry` product (`directCreditStoreWallet`, note "Bat246 board sale revenue"), then increments `homePlate.totalEarning` on that root board. No-op for non-positive amounts or missing data.

### `createBoardFromPurchase` (L150-L307)
Creates a new **pending** board for a purchase with no board context. Alan K (hardcoded admin email, L29) is always Home Plate; the buyer goes to the Dugout unless the buyer is Alan K himself ("self-setup"). Increments `boardCounter`/`familyCounter` on `Bat246Config`, tracking number `<family>-1000`, a 10-year placeholder protection period, empty upper slots, empty leaderboard, POD team id reserved via `assignPodTeamId`. For a real buyer it upserts the `Bat246Distributor` (`hasPurchasedProduct`, `isOfficeMember`, `playerId`), and if they now meet all three qualification flags (`isOfficeMember`, `hasBat246Membership`, `hasPurchasedProduct`) sets `isQualified`, assigns a distributor id and calls `maybeCreatePlacementNotification`.

### `addAtBatFromPurchase` - 1st Base invite link (L309-L483)
The buyer goes into the referrer's own AT BAT pair (first empty of the two). If both are filled the buyer goes to the Dugout (throws when the Dugout already holds 8), and that entry later earns the referrer their Gold card in `promoteDugoutAfterPP`. On an AT BAT landing the covering 1st Base slot gets `salesCredits + 1`, `warpStatus = min(credits, 2)`, and the board's `warpCount` is incremented the first time `warpStatus` reaches 2. A Green `Bat246SalesCredit` (`countsForLB: true`, carrying `saleAmount`) is written with a Green card back. Then: `Bat246PlayerBoard` row, `totalEntries + 1`, split if 8/8 on an active board, `payLbAndCreditHp`, and AT BAT wallet transfers to Home Plate and 3rd Base (`transferAtBatPayment`, `transferAtBatPaymentToThirdBase`). Returns `{ boardId, atBatSlot, shouldSplit, placedInDugout? }`.

### `addFromUpperBaseInvite` - 2nd Base A/B or 3rd Base link (L485-L550)
Always parks the buyer in the Dugout (max 8) with `referredBy` set to the referrer, then `payLbAndCreditHp`. The referrer's Black card is awarded later at promotion.

### `addFromGenericInvite` - any other referrer (L552-L780)
- If the referrer is a 1st Base player with 2+ Green Cards, or no AT BAT slot is empty, the buyer goes to the Dugout (max 8).
- Otherwise the buyer takes the first empty AT BAT slot; the covering 1st Base player gets a Green Card exactly as above.
- If the referrer is an AT BAT player without a card, their slot gets `cardType: "Gold"`.
- Home Plate referral bonus: on a child board (`generation > 0`), if the referrer is that board's Home Plate and `hpReferralBonusCount < 2`, the count increments and `nextHomePlatePayout` (default 200) is credited to their store wallet; if that Home Plate player has a `referredBy`, that recruiter also gets a $100 "green card referral bonus", and that $100 is deducted from the amount passed to `payLbAndCreditHp`.
- Then membership row, entry count, split check, revenue and wallet transfers.

### `addToDugoutFromPurchase` - Dugout player's link (L782-L847)
Pushes the buyer into the Dugout (max 8) attributed to the Dugout referrer, then `payLbAndCreditHp`.

### `promoteDugoutAfterPP` (L849-L1201)
Requires an active board whose `protectionPeriodEnd` has passed. Loops: re-reads the board, moves the first Dugout entry into the first empty AT BAT slot, until either runs out.
- **POD entries** (`podTeamId` set) are moved with no card or wallet side effects (their Gray Card was already awarded when the POD team filled).
- **Referrer on 1st Base:** with 2+ credits and no card -> Gold card (+ hotBox entry); with fewer credits and no card -> Green Card (`salesCredits + 1`); if they already hold a card, nothing.
- **Referrer on 2nd Base A/B or 3rd Base:** `blackCards + 1` (unlimited), `cardType: "Black"` if none, hotBox entry. **Referrer on Home Plate:** `brownCards + 1`, `cardType: "Brown"` if none, hotBox entry.
- **No Card:** if the AT BAT slot's covering 1st Base player is not the referrer (including when there is no referrer), they get `noCards + 1` and `cardType: "NoCard"` if they had none.
- Card history: `minorLeague.cardsEarned.<type>` increment, trophy check, and a `Bat246SalesCredit` row with the matching card back (Gold with "stolen from" details, Green, or Black/Brown via the Gold shape); a separate `NoCard` row (`countsForLB: false`) for the covering player. History failures are caught and logged.
- `Bat246PlayerBoard.position` becomes `atBat.<i>`, wallet transfers fire, and after the loop a split is triggered if 8/8. Returns `{ moved, splitTriggered }`.

### `addFromHomePlateInvite` (L1203-L1265)
Home Plate's invite link: requires an **active** board with a Home Plate occupant; parks the buyer in the Dugout (max 8) with `referredBy` = Home Plate, then `payLbAndCreditHp`. Home Plate's Brown card comes at promotion.

## Exports
- `creditRootHpUser(boardId, saleAmount): Promise<void>` - credit family root Home Plate store wallet.
- `createBoardFromPurchase(params: { userId, userName, userEmail, productId, countryResidence?, countryOrigin? }): Promise<{ boardId, trackingNumber }>`
- `addAtBatFromPurchase(params: { boardId, pos1stBase, userId, userName, userEmail, productId, saleAmount?, countryResidence?, countryOrigin? })`
- `addFromUpperBaseInvite(params: { boardId, referrerPosition: "2ndBaseA" | "2ndBaseB" | "3rdBase", referrerPlayerId, userId, userName, userEmail, productId, saleAmount?, countryResidence?, countryOrigin? })`
- `addFromGenericInvite(params: { boardId, referrerPlayerId, userId, userName, userEmail, productId, saleAmount?, countryResidence? })`
- `addToDugoutFromPurchase(params: { boardId, referredByPlayerId, userId, userName, userEmail, productId, saleAmount?, countryResidence?, countryOrigin? })`
- `promoteDugoutAfterPP(boardId): Promise<{ moved: number; splitTriggered: boolean }>`
- `addFromHomePlateInvite(params: { boardId, userId, userName, userEmail, productId, saleAmount?, countryResidence?, countryOrigin? })`

## Interfaces
- **Endpoints served (via `server/bat246/controllers/bat246.controller.ts`, router mounted at `/bat246`, browser `/backend/bat246`):** `POST /boards/:id/promote-dugout-pp` (`promoteDugoutAfterPP`), `POST /boards/:id/hp-invite` (`addFromHomePlateInvite`, body `userId, userEmail, productId, userName?, saleAmount?, countryResidence?, countryOrigin?`); `GET /boards/:id` also calls `promoteDugoutAfterPP` automatically when the protection period has expired and there is a Dugout entry plus an empty AT BAT slot.
- **Database:** `Bat246Board`, `Bat246Player`, `Bat246PlayerBoard`, `Bat246SalesCredit`, `Bat246Distributor`, `Bat246Config` (read/write); `User` (read, organization push); `Organization`, `Product` (read).
- **Background work:** fire-and-forget leaderboard payouts, root Home Plate credit, Lost Money auto-pay, wallet transfers, trophy checks and split triggers (errors logged, never thrown to the payment handler).

## Dependencies
- **Internal:** `../models/bat246Board|Player|Config|PlayerBoard|SalesCredit|Distributor.model`; `./bat246PlayerId.util` (`createBat246Player`); `./bat246Country.util` (`resolveCountryOrigin`); `./bat246Trophy.service` (`checkAndAwardTrophiesByCards`); `./bat246DistributorId.util` (`assignDistributorId`); `./bat246Split.service` (`splitBoardPhase1`); `./bat246.service` (`maybeCreatePlacementNotification`); `./bat246PodInvite.service` (`assignPodTeamId`); `./bat246Wallet.util` (`directCreditStoreWallet`, AT BAT transfers); `./bat246Leaderboard.service` (`payLbHolders`); `./bat246LostMoneyAutoPay.service` (`runLostMoneyAutoPay`); `./bat246CardBack.util`; `../../models/user.model`, `../../models/organization.model`, `../../models/product.model` (lazy `require`).
- **Packages:** `mongoose` - `Types.ObjectId`.

## Used by
`server/routes/invoice.ts`, `server/services/invoice.ts`, `server/routes/productCheckout.ts`, `server/routes/nowpaymentsWebhook.ts` (the four `add*` purchase functions, chosen by the invoice's BAT246 metadata: 1st Base position, upper-base ref, generic ref or Dugout ref), `server/bat246/controllers/bat246.controller.ts` (`promoteDugoutAfterPP`, `addFromHomePlateInvite`), and the maintenance script `server/bat246/scripts/fixDugoutPromotion.ts` (`promoteDugoutAfterPP`).

## Notes
- `createBoardFromPurchase` is imported by `invoice.ts`, `productCheckout.ts` and `nowpaymentsWebhook.ts`, but no call site was found in this repo; it appears unused.
- **Security:** `POST /bat246/boards/:id/hp-invite` passes a client-supplied `userId` and `saleAmount` straight into `addFromHomePlateInvite`, which seats that user and runs `payLbAndCreditHp(saleAmount)` (real store-wallet credits). The route only applies `requireAuth`, and no role check was found in the controller handler.
- Purchase paths cap the Dugout at 8 entries, while `placeUserInDugout` in `bat246.service.ts` treats it as unlimited.
- Green Cards from purchases are written with `countsForLB: true` and increment `warpCount`; manual placements in `bat246.service.ts` write `countsForLB: false` and do not touch `warpCount`.
- `addFromGenericInvite` sets an AT BAT referrer's `cardType: "Gold"` but, unlike the other Gold paths, does not increment `cardsEarned.gold`, run the trophy check or write a sales-credit history row.
- `promoteDugoutToAtBat` in `bat246Admin.service.ts` is an older copy of `promoteDugoutAfterPP` without the POD, 1st Base referrer and No Card handling.
- All read-then-write slot logic is non-transactional; concurrent purchases on the same board can race for the same AT BAT index.
