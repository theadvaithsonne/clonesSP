# `server/bat246/services/bat246Layaway.service.ts`

> The BAT246 "Layaway" B2 Coins system: computes how many coins a person may give away (five stacking eligibility pools plus any received balance), records gives and give-requests, keeps the coin wallet and history, and lets a buyer pay the $650 Board Entry or $160 POD Entry invoice with received coins.

**Kind:** BAT246 game module (backend) - service · **Lines:** 985

## Purpose
B2 Coins are an internal, non-cash currency. People who currently hold certain BAT246 positions or statuses earn "giving power" they can hand out to any member of the BAT246 office organization; recipients can spend the coins they received on one of the two BAT246 entry invoices. Someone without giving power can ask an eligible person to give on their behalf (a "layaway request"). This service holds all of that logic; `server/bat246/routes/bat246Layaway.routes.ts` is a thin HTTP layer over it, and `bat246SnapBackLoan.service.ts` reuses several exports.

## How it works

### Constants (L46-L88)
- Hardcoded identifiers: the Alan K admin email (L46), `BAT246_ORG_ID` (the BAT246 office organization), `BOARD_ENTRY_PRODUCT_ID` ($650), `POD_ENTRY_PRODUCT_ID` ($160), `KNOWN_ENTRY_PRODUCT_IDS`.
- `POOL_CAPS`: `homePlate` 1600, `podLastSale` 280, `leaderboard` up to 300, `matchingBonus` 400, `lineup1` 300 (`AUTO_PAY_ROUND_TARGET`, mirroring the Lost Money auto-pay round). `adminBypass` and `walletBalance` are pseudo-pools present only to keep the record exhaustive.
- `POOL_ORDER` allocates a gift largest-cap-first: homePlate, matchingBonus, leaderboard, lineup1, podLastSale.

### Eligibility - `computeLayawayEligibility(userId)` (L146-L235)
Always computed live. Alan K returns `isAlanK: true` with effectively unlimited totals. For everyone else, using their `Bat246Player` and every board they occupy:
- **homePlate** - seated at Home Plate on any board.
- **podLastSale** - also on Home Plate and is some board's `podEarnerPlayerId`.
- **leaderboard** - highest permanent trophy: Grand Slam 300, Home Run 200, Triple 100.
- **matchingBonus** - a recruit they referred (`homePlate.referredBy`) is Home Plate somewhere, and they hold a Gray Card (`grayCards` or `grayCard160` > 0) on a slot they occupy.
- **lineup1** - they are #1 (lowest `order`) in the active Lost Money "No Wait" lineup (`Bat246LostMoneyPaid`, same filter as the Lost Money routes).
"Already given" per pool is summed from the `breakdown` of every `Bat246B2CoinTransaction` they sent; it is permanent and never refunds, even if they later lose the qualifying condition. Caps **stack** (sum of all qualifying pools). Returns `{ eligible, isAlanK, totalCap, totalAlreadyGiven, totalRemaining, pools[] }`.

### Giving - `giveB2Coins(params)` (L237-L439)
1. `resolveGivenAmountForProduct` - with a `productId` (only the two known entry products) the amount is always the real `Product.price` and any client amount is ignored; otherwise a positive amount rounded to cents.
2. `verifyRecipientIsOfficeMember` - not yourself, and the recipient's `organizations` contains `BAT246_ORG_ID`.
3. Sendable = received wallet balance + pool `totalRemaining` (Alan K: unlimited, no debit). The wallet balance is used first; only the rest is allocated across pools (`allocateAcrossPools`, throws if it does not fit).
4. Writes an immutable `Bat246B2CoinTransaction` (`breakdown` lists `walletBalance` and/or pool portions, or `adminBypass` for Alan K), debits the giver's wallet (clamped at 0), credits the recipient's `Bat246B2CoinWallet`.
5. Any portion drawn from **lineup1** goes through `applyLineup1Give`: it adds to the person's Lost Money `roundAccumulated`; when the round target (`min(300, approvedAmount - totalPaid)`) is reached it finalizes the round like a real payout (`totalPaid`, `lastPayment*`, `fullyRepaid`, moves them to the end of the lineup, writes a `Bat246LostMoneyPayment` with `source: "layaway"`) without moving cash.
Returns the recomputed eligibility, amount and breakdown.

### Requests (L441-L500, L693-L854)
- `createLayawayRequest` - resolves the amount, checks the recipient against the eligible person, saves a `Bat246LayawayRequest`, creates a `layaway_request` `Bat246PlacementNotification` for the eligible person with a human-readable summary, and emails them (`bat246LayawayRequestEmailTemplate`; email failures are logged only).
- `respondToLayawayRequest` - only the eligible person, only while `pending`. Deny -> `denied`. Approve -> `giveB2Coins` with the request's amount, or a responder-chosen `overrideAmount` for plain-amount requests (product requests always use the product price); on success `approved` (amount updated to what was actually sent), on failure `insufficient_at_approval` and the error is rethrown.
- `cancelLayawayRequest` - only the requester, only while pending.
- `getMyLayawayRequests` (requests I sent) and `getLayawayRequestsForMe` (requests asking me) return `LayawayRequestView` rows with names resolved, newest first.

### Search (L502-L602)
- `personSearchClauses` builds forgiving `$or` clauses: plain substring, whitespace-insensitive match (so "red baron" finds "redbaron..."), and an all-words-any-order match (up to 5 words). All input is regex-escaped.
- `rankByMatch` orders exact, then starts-with, then contains (ignoring spaces/case).
- `searchBat246OfficeUsers(query, limit = 20)` searches users in the BAT246 office organization (over-fetches 3x then ranks).
- `searchEligiblePeople(query, limit = 20)` adds each candidate's eligibility, with `totalRemaining` deliberately overwritten to "pool remaining + wallet balance", and keeps only those who can send something. This differs on purpose from `/my-eligibility`, which reports pools only.

### Wallet - `getMyB2CoinWallet(userId, limit = 500)` (L604-L691)
Returns the wallet balance and a merged, newest-first history of received and sent transactions (each side capped at `limit`, then merged and capped again). Product labels come from a static two-entry map, never `Product.name`.

### Paying with coins - `payEntryProductWithB2Coins(invoiceId, userId)` (L856-L984)
Modelled on the invoice pay-with-wallet route. Checks, each throwing an error with a `code`: invoice exists (`NOT_FOUND`), belongs to the caller (`FORBIDDEN`), is `draft`/`pending` (`NOT_PAYABLE`), passes `refuseIfNotPayable`, its first line item is one of the two entry products (`WRONG_PRODUCT`), and the wallet balance covers `totalAmount / 100` (`INSUFFICIENT_BALANCE`). Then debits the wallet, marks the invoice `paid` with `metadata.paidWithB2Coins` and `b2CoinsAmount`, and calls `fulfillInvoice(invoice, "b2coins_<id>")` (board placement, qualification and distributor-id assignment all happen there). A fulfillment error is logged, not thrown. Finally records a `Bat246B2CoinProductPurchase` row (best effort). `paymentMethodCategory`/`paymentPlatform` are left unset on purpose because no enum value means "B2 Coins".

## Exports
- `BAT246_ORG_ID`, `BOARD_ENTRY_PRODUCT_ID`, `POD_ENTRY_PRODUCT_ID`, `KNOWN_ENTRY_PRODUCT_IDS` - hardcoded ids.
- `type PoolKey` - `"homePlate" | "podLastSale" | "leaderboard" | "matchingBonus" | "lineup1" | "adminBypass" | "walletBalance"`.
- `interface EligibilityPool`, `interface EligibilityResult`, `interface GiveResult`, `interface WalletTransactionView`, `interface WalletResult`, `interface LayawayRequestView`, `interface PayEntryWithB2CoinsResult`.
- `computeLayawayEligibility(userId): Promise<EligibilityResult>`
- `resolveGivenAmountForProduct(productId?, requestedAmount?): Promise<{ amount; productId | null }>`
- `verifyRecipientIsOfficeMember(recipientUserId, giverUserId)`
- `getWalletBalance(userId): Promise<number>`
- `giveB2Coins(params: { fromUserId, recipientUserId, amount?, productId?, requestId? }): Promise<GiveResult>`
- `createLayawayRequest(params: { requestedByUserId, eligibleUserId, recipientUserId, amount?, productId?, note? })`
- `searchBat246OfficeUsers(query, limit = 20)` / `searchEligiblePeople(query, limit = 20)`
- `getMyB2CoinWallet(userId, limit = 500): Promise<WalletResult>`
- `respondToLayawayRequest(requestId, responderUserId, approve, overrideAmount?)`
- `cancelLayawayRequest(requestId, requesterUserId)`
- `getMyLayawayRequests(userId, limit = 100)` / `getLayawayRequestsForMe(userId, limit = 100)`
- `payEntryProductWithB2Coins(invoiceId, userId): Promise<PayEntryWithB2CoinsResult>`

## Interfaces
- **Endpoints served (via `server/bat246/routes/bat246Layaway.routes.ts`, mounted at `/bat246/layaway`, browser `/backend/bat246/layaway`, all `requireAuth`):** `GET /my-eligibility`, `GET /my-wallet`, `GET /recipients/search`, `GET /eligible-people`, `POST /give`, `POST /request`, `POST /requests/:id/respond`, `POST /requests/:id/cancel`, `GET /my-requests`, `GET /requests-for-me`, `POST /pay-entry`.
- **Database:** `Bat246B2CoinWallet`, `Bat246B2CoinTransaction`, `Bat246B2CoinProductPurchase`, `Bat246LayawayRequest`, `Bat246PlacementNotification` (write); `Bat246LostMoneyPaid`, `Bat246LostMoneyPayment` (read/write via lineup1); `Bat246Board`, `Bat246Player`, `User`, `Product` (read); invoices via `getInvoice` (read/write).
- **External services:** email through `server/services/mailer.ts` (dynamic import).

## Dependencies
- **Internal:** the BAT246 models listed above; `../../models/user.model`, `../../models/product.model`; `../../utils/userSearchClauses` (`escapeRegex`); `../../services/invoice` (`getInvoice`, `fulfillInvoice`); `../../services/invoicePayable` (`refuseIfNotPayable`); `../../services/mailer` (dynamic).
- **Packages:** `mongoose` - `Types.ObjectId`.

## Used by
`server/bat246/routes/bat246Layaway.routes.ts` and `server/bat246/services/bat246SnapBackLoan.service.ts` (imports `computeLayawayEligibility`, `giveB2Coins`, `resolveGivenAmountForProduct`, `verifyRecipientIsOfficeMember`, `BOARD_ENTRY_PRODUCT_ID`, `POD_ENTRY_PRODUCT_ID`).

## Notes
- **No transactions.** The file header states this explicitly: balance checks and writes are check-then-write, matching other BAT246 money paths. Two concurrent gives can overspend a pool or wallet; the wallet debit is clamped at 0 rather than going negative. In `payEntryProductWithB2Coins` two concurrent payments could both pass the balance check.
- `searchEligiblePeople` runs `computeLayawayEligibility` (several queries) for every candidate; it can be slow for broad searches.
- `podLastSale` can never actually absorb part of a gift because it requires `homePlate`, which has a larger cap and is allocated first (documented in the code).
- `BOARD_ENTRY_PRODUCT_ID` is duplicated in `bat246BoardInvite.service.ts`.
