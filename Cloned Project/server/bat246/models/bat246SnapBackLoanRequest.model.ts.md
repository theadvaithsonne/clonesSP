# `server/bat246/models/bat246SnapBackLoanRequest.model.ts`

> Mongoose model for requests asking an eligible member to fund a Snap Back Loan, either for the requester or for a friend the requester refers.

**Kind:** BAT246 game module (backend) — Mongoose model · **Lines:** 49

## Purpose
This is the first step of the Snap Back Loan flow. A member asks an "eligible" person (someone who currently has B2 Coin giving power) to lend B2 Coins for a $650 Board Entry or $160 POD Entry. Three parties can be involved, as in `bat246LayawayRequest.model.ts`:
- the person asking (`requestedByUserId`),
- the borrower whose future earnings will be garnished (`borrowerUserId`),
- the eligible lender (`eligibleUserId`).

In a self-request, the requester and the borrower are the same person.

## How it works
Fields:
- `requestedByUserId`, `borrowerUserId`, `eligibleUserId`: all required, indexed, ref `User`.
- `productId` (ref `Product`), `productLabel` (`"board"` | `"pod"`), `amount` (≥ 0), `note`.
- `termsAcceptedAt` (required): set when the row is created. The frontend enables Submit only after an "I understand and agree" checkbox. In a referral, the referrer accepts the terms on the borrower's behalf, and the borrower is never asked to confirm.
- `status`: `pending` (default) → `approved` | `denied` | `insufficient_at_approval` | `cancelled`, indexed.
- `respondedAt`; `loanId` (ref `bat246SnapBackLoans`), set when the request is approved.
- `timestamps: true`.

Compound indexes `{eligibleUserId, status}` and `{borrowerUserId, status}` serve the "requests for me" and "has a pending request" lookups.

Lifecycle (in `bat246SnapBackLoan.service.ts`):
- `createSnapBackLoanRequest` checks that:
  - the lender is not the borrower,
  - the borrower is an office member,
  - the borrower has not already purchased an entry,
  - the borrower has no active loan and no pending request,
  - the lender is eligible.
  It then creates the request, creates a `snapbackloan_request` placement notification, and emails the lender.
- `respondToSnapBackLoanRequest` can only be called by the eligible user:
  - Deny → `denied`.
  - Approve → calls `giveB2Coins`, creates the loan, sets `approved` and `loanId`.
  - If the borrower already has an active loan, or the give fails, the status becomes `insufficient_at_approval`.
- `cancelSnapBackLoanRequest` can only be called by the requester, and only while the request is `pending`.

## Exports
- `Bat246SnapBackLoanRequest` — Mongoose model `bat246SnapBackLoanRequests`.

## Interfaces
- **Database:** `Bat246SnapBackLoanRequest` (collection `bat246snapbackloanrequests`).

## Dependencies
- **Packages:** `mongoose` - schema and model.

## Used by
- `server/bat246/services/bat246SnapBackLoan.service.ts` (the only importer), which backs the routes in `server/bat246/routes/bat246SnapBackLoan.routes.ts` (`/backend/bat246/snapbackloans/...`).

## Notes
- `requestedByUserId` was added after production rows already existed. Older documents lack it, so the service reads it through a fallback helper (`requestedByIdOf`) that uses `borrowerUserId` when the field is missing. Do the same in any new code that reads this field from `lean()` documents.
