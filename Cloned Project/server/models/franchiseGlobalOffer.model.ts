import { Schema, model, Document, Types } from "mongoose";

/**
 * Buyer-initiated resale offer on a global-catalog franchise assignment
 * (System A). Mirrors `FranchiseOffer` (System B) minus program/office
 * context — global assignments are platform-scoped, so there's no
 * `programId` / `officeId` to attach.
 *
 * Someone who wants to buy an already-owned `active` global assignment
 * submits an offer at a price above the current owner's `priceUSD`. The
 * OWNER (not the platform admin) accepts. On accept we mint a prorated
 * invoice for the buyer covering the remaining days of the current
 * subscription cycle; on payment ownership transfers, `expiresAt` is
 * preserved, and 100% of the paid amount is credited to the seller's
 * store wallet at PLATFORM_ORG_ID (matches where Shorupan gets credited
 * on original global sales — no office context in System A).
 *
 * Coexists with the (currently 501-stubbed) owner-initiated global
 * reassignment endpoints — that path stays stubbed for now.
 */

export type FranchiseGlobalOfferStatus =
  | "pending"
  | "accepted"
  | "rejected"
  | "cancelled"
  | "auto_rejected"
  | "expired";

export interface IFranchiseGlobalOfferResolutionRefs {
  resaleInvoiceId?: Types.ObjectId;
  renewalParentInvoiceId?: Types.ObjectId;
  sellerWalletTxId?: Types.ObjectId;
}

export interface IFranchiseGlobalOffer extends Document {
  _id: Types.ObjectId;

  assignmentId: Types.ObjectId;

  // Territory snapshot — survives entity rename/removal for audit + inbox.
  geoLevel: "country" | "territory" | "subTerritory";
  geoEntityId: string;
  geoEntityName?: string;

  fromUserId: Types.ObjectId;
  fromEmail: string;
  toUserId: Types.ObjectId;
  toEmail: string;

  currentPriceUSD: number;
  offerPriceUSD: number;

  message?: string;

  status: FranchiseGlobalOfferStatus;
  respondedAt?: Date;
  expiresAt: Date;

  invoiceId?: Types.ObjectId;
  resolutionTxRefs?: IFranchiseGlobalOfferResolutionRefs;

  createdAt: Date;
  updatedAt: Date;
}

const FranchiseGlobalOfferResolutionRefsSchema =
  new Schema<IFranchiseGlobalOfferResolutionRefs>(
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

const FranchiseGlobalOfferSchema = new Schema<IFranchiseGlobalOffer>(
  {
    assignmentId: {
      type: Schema.Types.ObjectId,
      ref: "FranchiseGlobalAssignment",
      required: true,
      index: true,
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
    resolutionTxRefs: FranchiseGlobalOfferResolutionRefsSchema,
  },
  { timestamps: true, collection: "franchise_global_offers" },
);

// At most one PENDING offer per (assignment, buyer). Multiple different
// buyers can hold pending offers on the same assignment concurrently
// (first-accept-wins).
FranchiseGlobalOfferSchema.index(
  { assignmentId: 1, fromUserId: 1 },
  { unique: true, partialFilterExpression: { status: "pending" } },
);

// Recipient inbox + sender outbox.
FranchiseGlobalOfferSchema.index({ toUserId: 1, status: 1, createdAt: -1 });
FranchiseGlobalOfferSchema.index({ fromUserId: 1, status: 1, createdAt: -1 });

// TTL sweep + "best pending offer on this assignment" reads.
FranchiseGlobalOfferSchema.index({ status: 1, expiresAt: 1 });
FranchiseGlobalOfferSchema.index({
  assignmentId: 1,
  status: 1,
  offerPriceUSD: -1,
});

export const FranchiseGlobalOffer = model<IFranchiseGlobalOffer>(
  "FranchiseGlobalOffer",
  FranchiseGlobalOfferSchema,
);
