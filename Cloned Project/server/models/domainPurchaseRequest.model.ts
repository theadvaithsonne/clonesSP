import mongoose, { Schema, Document } from "mongoose";

/**
 * A founder's request to buy a domain through Garage's name.com reseller
 * account.
 *
 * Registration is NOT automatic. Payment, refund-on-failure and renewal
 * billing are still undecided, so a request is recorded here and actioned
 * deliberately rather than a route spending money on its own. The registrant
 * details are collected up front because name.com requires them at
 * registration and chasing a founder for an address afterwards is worse.
 *
 * Garage is the registrant of record (reseller); these details identify the
 * founder the domain is held for.
 */
export interface IDomainPurchaseRequest extends Document {
  orgId: mongoose.Types.ObjectId;
  requestedBy: string;
  domain: string;
  /** What we quoted the founder — margin already applied. */
  priceUsd: number;
  renewalUsd: number;
  /** Which app the domain is meant to serve once registered. */
  kind: "app" | "shop";
  contact: {
    firstName: string;
    lastName: string;
    email: string;
    phone: string;
    address1: string;
    address2?: string;
    city: string;
    state: string;
    zip: string;
    /** ISO-3166 alpha-2, e.g. "IN", "CA". */
    country: string;
  };
  status: "pending" | "registered" | "rejected" | "failed";
  note?: string;
  createdAt: Date;
}

const DomainPurchaseRequestSchema = new Schema<IDomainPurchaseRequest>(
  {
    orgId: { type: Schema.Types.ObjectId, required: true, index: true },
    requestedBy: { type: String, required: true },
    domain: { type: String, required: true, lowercase: true, trim: true },
    priceUsd: { type: Number, default: 0 },
    renewalUsd: { type: Number, default: 0 },
    kind: { type: String, enum: ["app", "shop"], default: "app" },
    contact: {
      firstName: { type: String, required: true, trim: true },
      lastName: { type: String, required: true, trim: true },
      email: { type: String, required: true, trim: true },
      phone: { type: String, required: true, trim: true },
      address1: { type: String, required: true, trim: true },
      address2: { type: String, trim: true },
      city: { type: String, required: true, trim: true },
      state: { type: String, required: true, trim: true },
      zip: { type: String, required: true, trim: true },
      country: { type: String, required: true, trim: true, uppercase: true },
    },
    status: {
      type: String,
      enum: ["pending", "registered", "rejected", "failed"],
      default: "pending",
      index: true,
    },
    note: { type: String, trim: true },
  },
  { timestamps: { createdAt: true, updatedAt: true } },
);

// One open request per domain — a founder double-submitting shouldn't queue
// two registrations for the same name.
DomainPurchaseRequestSchema.index(
  { domain: 1, status: 1 },
  { unique: true, partialFilterExpression: { status: "pending" } },
);

export const DomainPurchaseRequest =
  mongoose.models.DomainPurchaseRequest ||
  mongoose.model<IDomainPurchaseRequest>(
    "DomainPurchaseRequest",
    DomainPurchaseRequestSchema,
  );
