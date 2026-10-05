import mongoose, { Schema, Document, Types } from "mongoose";

/**
 * Reserve licenses for sellable items (course / channel / workshop / call).
 *
 * When a buyer purchases multiple seats of an item, instead of activating
 * them all for the buyer immediately, the fulfillment code writes one
 * `ItemReserveLicense` per seat (status: "available"). The buyer can later
 * assign each reserve to another Garage user; on assignment, the
 * appropriate downstream artifact (CourseEnrollment, ChannelMembership,
 * WorkshopRegistration, CallPurchase) is created for the recipient and the
 * reserve flips to status: "assigned".
 *
 * This collection is intentionally separate from `reservelicenses` (the
 * Unilevel Plus-specific store). UP retains its own model + flow unchanged.
 */

export type ItemReserveType = "course" | "channel" | "workshop" | "call" | "product";

export type ItemReserveStatus = "available" | "assigned" | "expired";

export interface IItemReserveLicense extends Document {
  _id: Types.ObjectId;

  buyerId: Types.ObjectId;
  itemType: ItemReserveType;
  itemId: Types.ObjectId;
  itemName: string;
  itemImage?: string;
  organizationId: Types.ObjectId;

  invoiceId: Types.ObjectId;
  invoiceNumber: string;
  paymentId: string;
  seq: number;

  status: ItemReserveStatus;
  assignedTo?: Types.ObjectId;
  assignedAt?: Date;
  assignedArtifactRef?: {
    type:
      | "courseEnrollment"
      | "channelMembership"
      | "workshopRegistration"
      | "callPurchase";
    id: Types.ObjectId;
  };

  // Set while a `PendingReserveAssignment` is live for this reserve. Acts as
  // a lock — the free-assign path refuses to run while it is present, and the
  // partial unique index on the pending collection guarantees at most one
  // live offer per license.
  pendingAssignmentId?: Types.ObjectId;

  unitPrice: number;
  currency: string;

  metadata?: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

const AssignedArtifactRefSchema = new Schema(
  {
    type: {
      type: String,
      enum: [
        "courseEnrollment",
        "channelMembership",
        "workshopRegistration",
        "callPurchase",
      ],
      required: true,
    },
    id: { type: Schema.Types.ObjectId, required: true },
  },
  { _id: false }
);

const ItemReserveLicenseSchema = new Schema<IItemReserveLicense>(
  {
    buyerId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    itemType: {
      type: String,
      enum: ["course", "channel", "workshop", "call", "product"],
      required: true,
      index: true,
    },
    itemId: {
      type: Schema.Types.ObjectId,
      required: true,
      index: true,
    },
    itemName: { type: String, required: true },
    itemImage: { type: String },
    organizationId: {
      type: Schema.Types.ObjectId,
      ref: "Organization",
      required: true,
      index: true,
    },

    invoiceId: {
      type: Schema.Types.ObjectId,
      ref: "Invoice",
      required: true,
      index: true,
    },
    invoiceNumber: { type: String, required: true },
    paymentId: { type: String, required: true },
    seq: { type: Number, required: true, min: 0 },

    status: {
      type: String,
      enum: ["available", "assigned", "expired"],
      default: "available",
      index: true,
    },
    assignedTo: {
      type: Schema.Types.ObjectId,
      ref: "User",
    },
    assignedAt: { type: Date },
    assignedArtifactRef: AssignedArtifactRefSchema,

    pendingAssignmentId: {
      type: Schema.Types.ObjectId,
      ref: "PendingReserveAssignment",
    },

    unitPrice: { type: Number, required: true, min: 0 },
    currency: { type: String, default: "USD" },

    metadata: { type: Schema.Types.Mixed },
  },
  { timestamps: true, collection: "itemreservelicenses" }
);

// Buyer's reserve pool, filterable by status
ItemReserveLicenseSchema.index({ buyerId: 1, status: 1, createdAt: -1 });

// "Licenses someone gave me"
ItemReserveLicenseSchema.index({ assignedTo: 1, createdAt: -1 });

// Idempotency: (paymentId, seq) is unique per payment per seat slot.
// Re-firing fulfillment for a paid invoice will collide here and no-op,
// matching the existing UP `reserve_<invoiceId>_<seq>` uniqueness pattern.
ItemReserveLicenseSchema.index({ paymentId: 1, seq: 1 }, { unique: true });

export const ItemReserveLicense = mongoose.model<IItemReserveLicense>(
  "ItemReserveLicense",
  ItemReserveLicenseSchema
);
