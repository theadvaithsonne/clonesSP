import { Schema, model, Document, Types } from "mongoose";

/**
 * Buyer-initiated resale offer on a franchise territory (System B).
 *
 * Someone who wants to buy an already-owned `active` territory submits an
 * offer at a higher price than the current owner's `priceUSD`. The owner —
 * NOT the office founder — approves. On accept we mint a prorated invoice
 * for the buyer covering the remaining days of the CURRENT subscription
 * cycle; on payment ownership transfers, `subscription.expiresAt` is
 * preserved, and 100% of the paid amount is credited to the seller's
 * store wallet (platform + office founder get $0 on the resale itself —
 * they resume revenue at the next full annual renewal).
 *
 * Coexists with the shipped owner-initiated + founder-approved flow in
 * `FranchiseReassignment` — that path stays untouched.
 */

export type FranchiseOfferStatus =
  | "pending"
  | "accepted"
  | "rejected"
  | "cancelled"
  | "auto_rejected"
  | "expired";

export interface IFranchiseOfferResolutionRefs {
  resaleInvoiceId?: Types.ObjectId;
  renewalParentInvoiceId?: Types.ObjectId;
  sellerWalletTxId?: Types.ObjectId;
}

export interface IFranchiseOffer extends Document {
  _id: Types.ObjectId;

  assignmentId: Types.ObjectId;
  programId: Types.ObjectId;
  officeId: Types.ObjectId;

  // Territory snapshot — survives entity rename/removal for audit + inbox display.
  geoLevel: "country" | "territory" | "subTerritory";
  geoEntityId: string;
  geoEntityName?: string;

  fromUserId: Types.ObjectId;
  fromEmail: string;
  toUserId: Types.ObjectId;
  toEmail: string;

  currentPriceUSD: number; // owner's price at submission (snapshot)
  offerPriceUSD: number;

  message?: string;

  status: FranchiseOfferStatus;
  respondedAt?: Date;
  expiresAt: Date; // TTL — pending offers auto-expire after N days

  invoiceId?: Types.ObjectId; // resale invoice, set on accept
  resolutionTxRefs?: IFranchiseOfferResolutionRefs;

  createdAt: Date;
  updatedAt: Date;
}

const FranchiseOfferResolutionRefsSchema =
  new Schema<IFranchiseOfferResolutionRefs>(
    {
      resaleInvoiceId: { type: Schema.Types.ObjectId, ref: "Invoice" },
      renewalParentInvoiceId: { type: Schema.Types.ObjectId, ref: "Invoice" },
      sellerWalletTxId: {
        type: Schema.Types.ObjectId,
        ref: "WalletTransaction",
      },
    },
    { _id: false },
  );

const FranchiseOfferSchema = new Schema<IFranchiseOffer>(
  {
    assignmentId: {
      type: Schema.Types.ObjectId,
      ref: "FranchiseTerritoryAssignment",
      required: true,
      index: true,
    },
    programId: {
      type: Schema.Types.ObjectId,
      ref: "FranchiseProgram",
      required: true,
    },
    officeId: {
      type: Schema.Types.ObjectId,
      ref: "Organization",
      required: true,
    },
    geoLevel: {
      type: String,
      enum: ["country", "territory", "subTerritory"],
      required: true,
    },
    geoEntityId: { type: String, required: true },
    geoEntityName: { type: String },

    fromUserId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    fromEmail: { type: String, required: true, lowercase: true, trim: true },
    toUserId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    toEmail: { type: String, required: true, lowercase: true, trim: true },

    currentPriceUSD: { type: Number, required: true, min: 0 },
    offerPriceUSD: { type: Number, required: true, min: 0 },

    message: { type: String, maxlength: 280, trim: true },

    status: {
      type: String,
      enum: [
        "pending",
        "accepted",
        "rejected",
        "cancelled",
        "auto_rejected",
        "expired",
      ],
      default: "pending",
      index: true,
    },
    respondedAt: { type: Date },
    expiresAt: { type: Date, required: true, index: true },

    invoiceId: { type: Schema.Types.ObjectId, ref: "Invoice" },
    resolutionTxRefs: FranchiseOfferResolutionRefsSchema,
  },
  { timestamps: true, collection: "franchise_offers" },
);

// At most one PENDING offer per (assignment, buyer). Buyer can re-offer after
// prior cancels/rejects/expires. Multiple different buyers can hold pending
// offers on the same assignment simultaneously (first-accept-wins).
FranchiseOfferSchema.index(
  { assignmentId: 1, fromUserId: 1 },
  { unique: true, partialFilterExpression: { status: "pending" } },
);

// Recipient inbox (offers to owner) + sender outbox (buyer's own offers).
FranchiseOfferSchema.index({ toUserId: 1, status: 1, createdAt: -1 });
FranchiseOfferSchema.index({ fromUserId: 1, status: 1, createdAt: -1 });

// TTL sweep — finds pending rows past their expiresAt.
FranchiseOfferSchema.index({ status: 1, expiresAt: 1 });

// Group pending offers on the same assignment for the owner's incoming view.
FranchiseOfferSchema.index({ assignmentId: 1, status: 1, offerPriceUSD: -1 });

export const FranchiseOffer = model<IFranchiseOffer>(
  "FranchiseOffer",
  FranchiseOfferSchema,
);
