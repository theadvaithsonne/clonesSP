# `server/bat246/models/bat246SnapBackLoanRepayment.model.ts`

> Mongoose model for the immutable Snap Back Loan repayment ledger: one row for each real earning that was diverted to pay down a loan.

**Kind:** BAT246 game module (backend) — Mongoose model · **Lines:** 28

## Purpose
When a borrower with an active Snap Back Loan earns real BAT246 money, that money goes toward the loan instead of into their spendable StoreWallet balance. Each diversion is recorded here as an audit trail. In the service code these rows are only ever created, never updated. The file's comment compares this to the role `bat246LostMoneyPayment.model.ts` plays for the Lost Money cash auto-pay drip.

## How it works
Fields:
- `loanId` (required, indexed, ref `bat246SnapBackLoans`).
- `borrowerUserId` (required, indexed, ref `User`).
- `amount` (required, ≥ 0): how much of the earning went to the loan.
- `earningDescription`: the original `directCreditStoreWallet` description, for example "Bat246 AT BAT entry — payment to Home Plate". It shows which earning paid the loan down.
- `balanceAfter` (required, ≥ 0): the loan's outstanding balance after this deduction.
- `createdAt`: defaults to now.
- `timestamps: false`, so only `createdAt` exists.

`applySnapBackLoanRepayment` in `bat246SnapBackLoan.service.ts` writes a row right after it saves the loan's new `outstandingBalance`. `getMySnapBackLoan` reads rows by `loanId`, newest first.

## Exports
- `Bat246SnapBackLoanRepayment` — Mongoose model `bat246SnapBackLoanRepayments`.

## Interfaces
- **Database:** `Bat246SnapBackLoanRepayment` (collection `bat246snapbackloanrepayments`).

## Dependencies
- **Packages:** `mongoose` - schema and model.

## Used by
- `server/bat246/services/bat246SnapBackLoan.service.ts` (the only importer). It writes rows in the repayment hook and reads them for the "My Loan" view behind `GET /backend/bat246/snapbackloans/my-loan`.

## Notes
- The loan update and the ledger insert are two separate writes with no transaction around them. A crash between the two would leave the loan reduced with no ledger row.
