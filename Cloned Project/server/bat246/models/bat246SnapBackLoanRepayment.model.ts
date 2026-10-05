import { Schema, model, Types } from "mongoose";

/**
 * Immutable per-deduction ledger for Snap Back Loan repayments — one row
 * per real earning that got diverted toward a loan instead of landing in
 * the borrower's spendable StoreWallet balance. Same role
 * bat246LostMoneyPayment.model.ts plays for the cash auto-pay drip.
 */
const Bat246SnapBackLoanRepaymentSchema = new Schema(
  {
    loanId: { type: Types.ObjectId, ref: "bat246SnapBackLoans", required: true, index: true },
    borrowerUserId: { type: Types.ObjectId, ref: "User", required: true, index: true },
    amount: { type: Number, required: true, min: 0 },
    // The original directCreditStoreWallet description this deduction was
    // taken from (e.g. "Bat246 AT BAT entry — payment to Home Plate") —
    // kept for an honest audit trail of what earning paid down the loan.
    earningDescription: { type: String, default: "" },
    balanceAfter: { type: Number, required: true, min: 0 },
    createdAt: { type: Date, default: () => new Date() },
  },
  { timestamps: false }
);

export const Bat246SnapBackLoanRepayment = model(
  "bat246SnapBackLoanRepayments",
  Bat246SnapBackLoanRepaymentSchema
);
