import { Schema, model, Types } from "mongoose";

/**
 * A Snap Back Loan — B2 Coins borrowed (not gifted) to purchase the $650
 * Board Entry / $160 POD Entry, automatically repaid from the borrower's
 * own future real BAT246 earnings (see applySnapBackLoanRepayment in
 * bat246SnapBackLoan.service.ts, hooked into the single
 * directCreditStoreWallet choke point in bat246Wallet.util.ts).
 *
 * One row per approved bat246SnapBackLoanRequest. Deliberately no
 * separate `totalRepaid` field — always derive `repaid = principal -
 * outstandingBalance`. This codebase has already hit the "two numbers
 * meant to agree silently drift apart" bug more than once on unrelated
 * fields this same engagement; not repeating it here.
 */
const Bat246SnapBackLoanSchema = new Schema(
  {
    borrowerUserId: { type: Types.ObjectId, ref: "User", required: true, index: true },
    giverUserId: { type: Types.ObjectId, ref: "User", required: true },
    requestId: {
      type: Types.ObjectId,
      ref: "bat246SnapBackLoanRequests",
      required: true,
      unique: true,
    },
    productId: { type: Types.ObjectId, ref: "Product", required: true },
    productLabel: { type: String, enum: ["board", "pod"], required: true },
    principal: { type: Number, required: true, min: 0 },
    outstandingBalance: { type: Number, required: true, min: 0 },
    status: { type: String, enum: ["active", "repaid"], default: "active", index: true },
    // Set once the borrower actually spends the loaned coins via
    // payEntryProductWithB2Coins — informational only, the debt exists
    // from approval regardless of whether/when this gets set.
    invoiceId: { type: Types.ObjectId, ref: "Invoice", default: null },
    repaidAt: { type: Date, default: null },
  },
  { timestamps: true }
);

Bat246SnapBackLoanSchema.index({ borrowerUserId: 1, status: 1 });

export const Bat246SnapBackLoan = model("bat246SnapBackLoans", Bat246SnapBackLoanSchema);
