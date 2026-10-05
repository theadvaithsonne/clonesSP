import { Schema, model, Types } from "mongoose";

/**
 * "Ask an eligible person to fund a Snap Back Loan" — 3-party like
 * bat246LayawayRequest.model.ts: `requestedByUserId` (who's asking) can
 * differ from `borrowerUserId` (whose future earnings actually get
 * garnished) when someone without giving power of their own refers a
 * friend/contact to an eligible lender. Approved design: the referrer
 * accepts the loan terms on the borrower's behalf at submission time
 * (termsAcceptedAt) — the borrower is never asked to separately confirm,
 * same as the plain B2 Coins Give/Request flow never asks its recipient
 * to confirm anything either. For a self-request (the common case),
 * requestedByUserId === borrowerUserId. See bat246SnapBackLoan.service.ts
 * for the full request → approve → loan lifecycle.
 */
const Bat246SnapBackLoanRequestSchema = new Schema(
  {
    requestedByUserId: { type: Types.ObjectId, ref: "User", required: true, index: true },
    borrowerUserId: { type: Types.ObjectId, ref: "User", required: true, index: true },
    eligibleUserId: { type: Types.ObjectId, ref: "User", required: true, index: true },
    productId: { type: Types.ObjectId, ref: "Product", required: true },
    productLabel: { type: String, enum: ["board", "pod"], required: true },
    amount: { type: Number, required: true, min: 0 },
    note: { type: String, default: "" },
    // Set at creation time — the frontend only allows Submit after an
    // explicit "I understand and agree" checkbox, so acceptance is
    // implicit at the moment this row is created, no separate accept step.
    termsAcceptedAt: { type: Date, required: true },
    status: {
      type: String,
      enum: ["pending", "approved", "denied", "insufficient_at_approval", "cancelled"],
      default: "pending",
      index: true,
    },
    respondedAt: { type: Date, default: null },
    // Set once approved — points at the resulting debt record.
    loanId: { type: Types.ObjectId, ref: "bat246SnapBackLoans", default: null },
  },
  { timestamps: true }
);

Bat246SnapBackLoanRequestSchema.index({ eligibleUserId: 1, status: 1 });
Bat246SnapBackLoanRequestSchema.index({ borrowerUserId: 1, status: 1 });

export const Bat246SnapBackLoanRequest = model(
  "bat246SnapBackLoanRequests",
  Bat246SnapBackLoanRequestSchema
);
