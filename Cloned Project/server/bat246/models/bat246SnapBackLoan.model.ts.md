# `server/bat246/models/bat246SnapBackLoan.model.ts`

> Mongoose model for a Snap Back Loan: B2 Coins lent to a member to buy a BAT246 entry, tracked as a debt that is repaid automatically from the borrower's future earnings.

**Kind:** BAT246 game module (backend) — Mongoose model · **Lines:** 43

## Purpose
A Snap Back Loan (SBL) lets an eligible member fund someone's $650 Board Entry or $160 POD Entry with B2 Coins as a loan instead of a gift. The coins themselves move through the normal B2 Coins give flow. This document only records the borrower's debt and its repayment state. Exactly one loan row is created for each approved `bat246SnapBackLoanRequests` document.

## How it works
Fields:
- `borrowerUserId` (required, indexed, ref `User`): the person whose future earnings get diverted.
- `giverUserId` (required, ref `User`): the lender who approved the request.
- `requestId` (required, **unique**, ref `bat246SnapBackLoanRequests`): stops two loans being created from one request.
- `productId` (ref `Product`) and `productLabel` (`"board"` | `"pod"`).
- `principal` and `outstandingBalance`: both required, minimum 0.
- `status`: `"active"` (default) or `"repaid"`, indexed.
- `invoiceId` (ref `Invoice`, default null): meant to be informational, set when the borrower spends the loaned coins.
- `repaidAt`.
- `timestamps: true`.

Compound index `{borrowerUserId, status}` serves the "does this user have an active loan?" check that the service runs on every earning.

Design invariant (from the file's comment): there is deliberately no `totalRepaid` field. Always derive it as `principal - outstandingBalance`, so two numbers can never drift apart.

Lifecycle (in `bat246SnapBackLoan.service.ts`):
1. `respondToSnapBackLoanRequest` creates the row with `principal = outstandingBalance = ` the amount given.
2. `applySnapBackLoanRepayment` is called from `directCreditStoreWallet` in `bat246Wallet.util.ts`. It reduces `outstandingBalance` by up to the full earning. Once the balance reaches about 0 (≤ 0.004), it sets `status: "repaid"` and `repaidAt`.

## Exports
- `Bat246SnapBackLoan` — Mongoose model `bat246SnapBackLoans`.

## Interfaces
- **Database:** `Bat246SnapBackLoan` (collection `bat246snapbackloans`).

## Dependencies
- **Packages:** `mongoose` - schema and model.

## Used by
- `server/bat246/services/bat246SnapBackLoan.service.ts`: creates loans, applies repayments, and lists loans for the member and admin views.
- `server/bat246/scripts/backupAndWipeBat246.ts`: a manual backup/wipe script that runs against the production database.

## Notes
- Nothing in `server/` currently writes `invoiceId`. A search turns up no setter, so expect it to stay null.
- The service allows only one `active` loan per borrower. It checks this both when a request is created and again when the request is approved.
