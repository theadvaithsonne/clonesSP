import mongoose, { Schema, Document, Types } from "mongoose";

/**
 * A paid reserve-assignment offer that requires the recipient's approval
 * before the license transfers or any money moves. While
 * `status === "pending"` the parent `ItemReserveLicense.pendingAssignmentId`
 * points here, locking the reserve from being re-assigned or used.
 *
 * Lifecycle: pending → approved | rejected | cancelled. No auto-expiry —
 * pending offers stay live until acted on by the recipient or cancelled by
 * the sender (matches `PendingCouponGift`).
 *
 * Cross-org payment is the deliberate twist vs PendingCouponGift: the
 * sender's credit lands in `orgId` (sender's current org at offer creation),
 * but the recipient chooses which of their own office Store wallets to debit
 * at approve time — that choice is supplied to the service, not stored here.
 */
export type PendingReserveAssignmentStatus =
  | "pending"
  | "approved"
  | "rejected"
  | "cancelled";

export type PendingReserveItemType =
  | "course"
  | "channel"
  | "workshop"
  | "call"
  | "product";

export interface IPendingReserveAssignment extends Document {
  _id: Types.ObjectId;
  fromUserId: Types.ObjectId;
  toUserId: Types.ObjectId;
  fromLicenseId: Types.ObjectId;

  // Snapshot of the underlying reserve so the inbox card renders correctly
  // even if the source is mutated/removed mid-flight.
  itemType: PendingReserveItemType;
  itemId: Types.ObjectId;
  itemName: string;
  itemImage?: string;
  unitPrice: number; // original license.unitPrice — audit only

  // Where the credit lands on approve (sender's active org at offer creation).
  orgId: Types.ObjectId;

  // USD amount the recipient pays the sender on approve.
  priceUsd: number;
  currency: string;
  message?: string;

  status: PendingReserveAssignmentStatus;
  respondedAt?: Date;

  resolutionTxRefs?: {
    senderWalletTxId?: Types.ObjectId;
    recipientWalletTxId?: Types.ObjectId;
    assignedArtifactRef?: {
      type: string;
      id: Types.ObjectId;
    };
  };

  createdAt: Date;
  updatedAt: Date;
}

const AssignedArtifactRefSchema = new Schema(
  {
    type: { type: String, required: true },
    id: { type: Schema.Types.ObjectId, required: true },
  },
  { _id: false }
);

const ResolutionTxRefsSchema = new Schema(
  {
    senderWalletTxId: { type: Schema.Types.ObjectId, ref: "WalletTransaction" },
    recipientWalletTxId: {
      type: Schema.Types.ObjectId,
      ref: "WalletTransaction",
    },
    assignedArtifactRef: AssignedArtifactRefSchema,
  },
  { _id: false }
);

const PendingReserveAssignmentSchema = new Schema<IPendingReserveAssignment>(
  {
    fromUserId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    toUserId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    fromLicenseId: {
      type: Schema.Types.ObjectId,
      ref: "ItemReserveLicense",
      required: true,
    },

    itemType: {
      type: String,
      enum: ["course", "channel", "workshop", "call", "product"],
      required: true,
    },
    itemId: { type: Schema.Types.ObjectId, required: true },
    itemName: { type: String, required: true },
    itemImage: { type: String },
    unitPrice: { type: Number, required: true, min: 0 },

    orgId: {
      type: Schema.Types.ObjectId,
      ref: "Organization",
      required: true,
    },

    priceUsd: { type: Number, required: true, min: 0.01 },
    currency: { type: String, default: "USD" },
    message: { type: String, maxlength: 500 },

    status: {
      type: String,
      enum: ["pending", "approved", "rejected", "cancelled"],
      default: "pending",
      index: true,
    },
    respondedAt: { type: Date },
    resolutionTxRefs: ResolutionTxRefsSchema,
  },
  { timestamps: true }
);

// At most one pending offer per license — guarantees the sender-side lock
// is bulletproof under concurrency. A second insert collides with E11000.
PendingReserveAssignmentSchema.index(
  { fromLicenseId: 1 },
  { unique: true, partialFilterExpression: { status: "pending" } }
);

// Recipient inbox + sender outbox queries.
PendingReserveAssignmentSchema.index({
  toUserId: 1,
  status: 1,
  createdAt: -1,
});
PendingReserveAssignmentSchema.index({
  fromUserId: 1,
  status: 1,
  createdAt: -1,
});

export const PendingReserveAssignment =
  mongoose.model<IPendingReserveAssignment>(
    "PendingReserveAssignment",
    PendingReserveAssignmentSchema
  );
