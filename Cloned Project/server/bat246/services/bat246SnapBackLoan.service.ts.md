# `server/bat246/services/bat246SnapBackLoan.service.ts`

> Business logic for BAT246 Snap Back Loans: B2 Coins lent to a member so they can buy their $650 Board Entry or $160 POD Entry, then repaid automatically out of that member's future BAT246 earnings.

**Kind:** BAT246 game module (backend) — service · **Lines:** 547

## Purpose
Snap Back Loans (SBL) sit on top of the B2 Coins give/request system in `bat246Layaway.service.ts`.
- **Request and approval.** A borrower, or a referrer acting on the borrower's behalf, asks an eligible lender for a loan. If the lender approves, the coins move through the existing, unmodified `giveB2Coins()`. The loan therefore draws on the lender's normal pool capacity, with no new allocation logic.
- **The loan record.** It only tracks the borrower's debt. Repayment never goes back to the lender.
- **Repayment.** `applySnapBackLoanRepayment()` is called from `directCreditStoreWallet()` in `bat246Wallet.util.ts`, the single point every real BAT246 earning passes through. Every earning is diverted to the loan until it is repaid.

## How it works

### Helpers (L39-L63)
- `labelForProduct` maps `BOARD_ENTRY_PRODUCT_ID` to `"board"` and `POD_ENTRY_PRODUCT_ID` to `"pod"`.
- `productDisplayLabel` turns those into "$650 Board Entry" and "$160 POD Entry".
- `requestedByIdOf` falls back to `borrowerUserId` for older rows that have no `requestedByUserId`. Every read of that field must go through it.
- `namesFor` batch-loads user names and emails.

### Creating a request (L65-L187)
`createSnapBackLoanRequest`:
- **Referral or self.** `isReferral` (requester ≠ borrower) only changes the wording of the error messages.
- **Validation:**
  - the lender cannot be the borrower;
  - `verifyRecipientIsOfficeMember` must pass;
  - the product must resolve to Board or POD through `resolveGivenAmountForProduct`;
  - the borrower must not already have `hasPurchasedProduct`;
  - there must be no active loan and no pending request for that borrower;
  - the lender must be eligible according to `computeLayawayEligibility`, unless the lender is Alan K.
- **Records.** It creates a `Bat246SnapBackLoanRequest` (with `termsAcceptedAt` set to now) and a `Bat246PlacementNotification` of type `"snapbackloan_request"` addressed to the lender. Each has a readable summary.
- **Email.** It emails the lender with `bat246SnapBackLoanRequestEmailTemplate`. Email failures are logged and never block the request.

### Responding and cancelling (L189-L271)
**`respondToSnapBackLoanRequest(requestId, responderUserId, approve)`**
- Only the named lender may respond, and only to a pending request.
- **Deny.** Sets status `denied`.
- **Approve, borrower already has a loan.** It re-checks for an active loan. If one exists, it sets `insufficient_at_approval` and throws.
- **Approve, normal case.** It calls `giveB2Coins({ fromUserId, recipientUserId, productId })`. It then creates a `Bat246SnapBackLoan` with principal and outstanding balance both equal to the given amount and status `active`, and sets the request to `approved` with its `loanId`.
- **Approve, give fails.** Any failure in the give marks the request `insufficient_at_approval` and rethrows.

**`cancelSnapBackLoanRequest`** lets only the original requester cancel a pending request.

### Repayment hook (L273-L313)
`applySnapBackLoanRepayment(userId, earnedAmount, description)`:
- Finds the user's active loan.
- Diverts `min(earned, outstanding)`, rounded to cents, and lowers `outstandingBalance`.
- Marks the loan `repaid` with `repaidAt` once the balance is at most $0.004.
- Logs a `Bat246SnapBackLoanRepayment` row.
- Returns `{ divert, remainder }` for the caller to credit. With no active loan, it returns `divert: 0`.

### Read models (L315-L546)
- `getMySnapBackLoan` returns the borrower's latest loan with giver details and the repayment ledger.
- `getMySnapBackLoanRequests` returns requests the user submitted. Older rows without `requestedByUserId` are matched by `borrowerUserId`.
- `getSnapBackLoanRequestsForMe` returns requests where the user is the lender.
- `shapeLoanRows` builds the grid rows. It includes `borrowerCurrentGivingPower`, which comes from `computeLayawayEligibility` (one call per loan); it is `Number.MAX_SAFE_INTEGER` for Alan.
- `adminListSnapBackLoans` returns every loan.
- `getMySnapBackLoanActivity` returns the loans the user borrowed or funded.

## Exports
- **Request lifecycle:**
  - `createSnapBackLoanRequest({ requestedByUserId, borrowerUserId, eligibleUserId, productId, note? })` — returns the request document.
  - `respondToSnapBackLoanRequest(requestId, responderUserId, approve)` — returns `{ status: "denied" }` or `{ status: "approved", loan }`.
  - `cancelSnapBackLoanRequest(requestId, requesterUserId)` — returns `{ status: "cancelled" }`.
- **Repayment:** `applySnapBackLoanRepayment(userId, earnedAmount, description)` — returns `{ divert, remainder }`.
- **Queries:**
  - `getMySnapBackLoan(borrowerUserId): Promise<SnapBackLoanView | null>`
  - `getMySnapBackLoanRequests(userId, limit = 100)` and `getSnapBackLoanRequestsForMe(userId, limit = 100)`, both returning `SnapBackLoanRequestView[]`.
  - `adminListSnapBackLoans(limit = 200)` and `getMySnapBackLoanActivity(userId, limit = 200)`, both returning `AdminSnapBackLoanRow[]`.
- **Interfaces:** `SnapBackLoanRepaymentView`, `SnapBackLoanView`, `SnapBackLoanRequestView` (includes `isReferral`), `AdminSnapBackLoanRow`.

## Interfaces
- **Endpoints served (indirectly):** `server/bat246/routes/bat246SnapBackLoan.routes.ts` is mounted at `/bat246/snapbackloans`, so the browser paths start with `/backend/bat246/snapbackloans`. All routes are `requireAuth`. `/admin/list` is also gated by `isBat246CardAdmin(..., "snapbackloans")`.
  - `POST /request`
  - `POST /requests/:id/respond`
  - `POST /requests/:id/cancel`
  - `GET /my-requests`
  - `GET /requests-for-me`
  - `GET /my-loan`
  - `GET /my-activity`
  - `GET /admin/list`
- **Database:**
  - Reads and writes `Bat246SnapBackLoanRequest` (model `bat246SnapBackLoanRequests`) and `Bat246SnapBackLoan` (model `bat246SnapBackLoans`).
  - Creates `Bat246SnapBackLoanRepayment` and `Bat246PlacementNotification` rows.
  - Reads `Bat246Distributor` and `User`.
  - Coin movements happen inside `giveB2Coins`.
- **External services:** email through `server/services/mailer.ts`.

## Dependencies
- **Internal:**
  - `bat246Layaway.service.ts`: `computeLayawayEligibility`, `giveB2Coins`, `resolveGivenAmountForProduct`, `verifyRecipientIsOfficeMember` and the product id constants.
  - The SBL request, loan and repayment models, the placement-notification model and the distributor model.
  - `server/models/user.model.ts`.
  - `server/services/mailer.ts`, lazily imported.
- **Packages:** `mongoose` (`Types`).

## Used by
- `server/bat246/routes/bat246SnapBackLoan.routes.ts`.
- `server/bat246/services/bat246Wallet.util.ts`, which calls `applySnapBackLoanRepayment` lazily from `directCreditStoreWallet`.

## Notes
- **The approval re-check is not atomic.** It and the creation of the loan are separate steps, so two concurrent approvals for the same borrower could both pass the check.
- **A wallet failure can leave a loan marked repaid with no money credited.** `applySnapBackLoanRepayment` saves the loan before the caller credits the wallet; if the wallet write then fails, the money was still counted as repayment.
- **The admin grid is slow for many loans.** `shapeLoanRows` calls `computeLayawayEligibility` once per loan, one after another, which is O(n) eligibility computations.
