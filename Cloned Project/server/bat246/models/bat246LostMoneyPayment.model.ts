import { Schema, model, Types } from "mongoose";

// One row per completed $300 (or smaller, final) repayment round — the
// audit trail behind Bat246LostMoneyPaid.totalPaid. Written exclusively by
// the automated 3%-of-sale drip (bat246LostMoneyAutoPay.service.ts); there
// is no manual payment path anymore.
const Bat246LostMoneyPaymentSchema = new Schema(
  {
    paidEntryId: { type: Types.ObjectId, ref: "bat246LostMoneyPaid", required: true, index: true },
    amount: { type: Number, required: true },
    recordedByEmail: { type: String, default: "" },
    note: { type: String, default: "" },
    source: { type: String, enum: ["auto"], default: "auto" },
  },
  { timestamps: true }
);

export const Bat246LostMoneyPayment = model("bat246LostMoneyPayment", Bat246LostMoneyPaymentSchema);
