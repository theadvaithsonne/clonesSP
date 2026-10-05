import { Schema, model, Document, Types } from "mongoose";

/**
 * A territory the founder has assigned/sold to a buyer within a
 * `FranchiseProgram`. The geographic entity itself comes from the read-only
 * global catalog (franchise_countries / franchise_territorymasters /
 * franchise_sub_territories) — we store only the reference (`geoLevel` +
 * `geoEntityId`) plus denormalized fields needed for buyer-address matching
 * and display. Ownership and pricing live HERE, never on the catalog (which
 * the Garage backend never writes).
 *
 * Activation is payment-gated: the buyer's $650/yr (or custom ≥ $650) invoice
 * being PAID flips status `pending_payment` → `active`. Subscription lapse
 * flips `active` → `paused_lapsed` (earning pauses, slot kept). Only `active`
 * assignments earn commission.
 */

export type FranchiseAssignmentStatus =
  | "listed"           // Founder created a listing; no buyer yet
  | "pending_payment"  // A buyer has claimed; invoice minted, awaiting payment
  | "active"           // Paid + subscription window open
  | "paused_lapsed"    // Subscription lapsed
  | "withdrawn"        // Founder pulled the listing before anyone claimed
  | "cancelled";       // Admin/founder cancelled a claimed assignment

export type FranchiseGeoLevel = "country" | "territory" | "subTerritory";

export interface IFranchiseAssignmentSubscription {
  invoiceId?: Types.ObjectId;
  startedAt?: Date;
  expiresAt?: Date;
  lastPaymentInvoiceId?: Types.ObjectId;
}

export type ReassignmentStatus = "pending_approval" | "approved" | "rejected";

/**
 * Phase 2 buyer→buyer resale. The current owner requests a reassignment to a
 * new owner at a resale price; the office founder must approve before the new
 * owner is billed. On payment of the resale invoice, ownership transfers and
 * the reseller is credited the markup over the $650 floor.
 */
export interface IPendingReassignment {
  status: ReassignmentStatus;
  resellerUserId: Types.ObjectId; // the current owner selling it
  newOwnerUserId: Types.ObjectId;
  newOwnerEmail: string;
  resalePriceUSD: number;
  invoiceId?: Types.ObjectId; // set at founder approval
  requestedAt?: Date;
  decidedAt?: Date;
  /** Link to the durable FranchiseReassignment ledger row for this request. */
  reassignmentId?: Types.ObjectId;
}

/**
 * How the current owner acquired this territory:
 *   "original" — bought directly from the founder (the first sale).
 *   "resale"   — acquired via a buyer→buyer reassignment.
 */
export type AcquisitionType = "original" | "resale";

/**
 * Lock held on an assignment when the owner has accepted a buyer-initiated
 * resale offer and the buyer's prorated invoice is awaiting payment. While
 * this sub-doc is set, the owner cannot accept any other offer on the same
 * assignment (see `POST /offers/:id/accept`). Cleared on payment (transfer
 * completes) or when the invoice cancels/expires (offer + lock released).
 */
export interface IPendingResaleOffer {
  offerId: Types.ObjectId;
  buyerUserId: Types.ObjectId;
  buyerEmail: string;
  agreedPriceUSD: number;
  resaleInvoiceId: Types.ObjectId;
  acceptedAt: Date;
}

export interface IFranchiseTerritoryAssignment extends Document {
  _id: Types.ObjectId;
  programId: Types.ObjectId;
  officeId: Types.ObjectId;

  geoLevel: FranchiseGeoLevel;
  /** String `_id` of the catalog entity (catalog docs use string _ids). */
  geoEntityId: string;
  geoEntityName?: string;
  geoCountry?: string;
  geoParentTerritory?: string;
  zipCodes?: string[];

  // Optional — unset while status="listed" or "withdrawn" (no buyer yet).
  // Set when a buyer claims the listing (status→"pending_payment") and
  // stays set through the paid lifecycle.
  ownerUserId?: Types.ObjectId;
  ownerEmail?: string;

  priceUSD: number;
  // Founder or admin who created the row. Always set. For a founder-created
  // listing this is the founder; for a direct assign, also the founder.
  assignedByUserId: Types.ObjectId;

  status: FranchiseAssignmentStatus;
  subscription: IFranchiseAssignmentSubscription;
  pendingReassignment?: IPendingReassignment | null;
  // Set when the owner accepts a buyer-initiated resale offer; cleared on
  // resale invoice payment / cancel / expiry. Presence of this sub-doc
  // blocks accepting further offers on the same assignment.
  pendingResaleOffer?: IPendingResaleOffer | null;

  // How the CURRENT owner got this territory. "original" by default; flips to
  // "resale" when ownership transfers via a completed reassignment.
  acquisitionType: AcquisitionType;
  /** The completed FranchiseReassignment the current owner acquired this via. */
  acquiredReassignmentId?: Types.ObjectId;

  createdAt: Date;
  updatedAt: Date;
}

const AssignmentSubscriptionSchema =
  new Schema<IFranchiseAssignmentSubscription>(
    {
      invoiceId: { type: Schema.Types.ObjectId, ref: "Invoice" },
      startedAt: { type: Date },
      expiresAt: { type: Date },
      lastPaymentInvoiceId: { type: Schema.Types.ObjectId, ref: "Invoice" },
    },
    { _id: false }
  );

const FranchiseTerritoryAssignmentSchema =
  new Schema<IFranchiseTerritoryAssignment>(
    {
      programId: {
        type: Schema.Types.ObjectId,
        ref: "FranchiseProgram",
        required: true,
        index: true,
      },
      officeId: {
        type: Schema.Types.ObjectId,
        ref: "Organization",
        required: true,
        index: true,
      },

      geoLevel: {
        type: String,
        enum: ["country", "territory", "subTerritory"],
        required: true,
      },
      geoEntityId: { type: String, required: true, index: true },
      geoEntityName: { type: String },
      geoCountry: { type: String },
      geoParentTerritory: { type: String },
      zipCodes: { type: [String] },

      // Optional — a "listed" row has no owner until someone claims it.
      // Downstream consumers (assignmentPayload, earnings, invoice fulfilment)
      // null-guard these fields.
      ownerUserId: {
        type: Schema.Types.ObjectId,
        ref: "User",
        required: false,
        index: true,
      },
      ownerEmail: { type: String, required: false, trim: true, lowercase: true },

      priceUSD: { type: Number, required: true, min: 0 },
      assignedByUserId: {
        type: Schema.Types.ObjectId,
        ref: "User",
        required: true,
      },

      status: {
        type: String,
        enum: [
          "listed",
          "pending_payment",
          "active",
          "paused_lapsed",
          "withdrawn",
          "cancelled",
        ],
        default: "pending_payment",
        index: true,
      },
      subscription: {
        type: AssignmentSubscriptionSchema,
        default: () => ({}),
      },
      pendingReassignment: {
        type: new Schema<IPendingReassignment>(
          {
            status: {
              type: String,
              enum: ["pending_approval", "approved", "rejected"],
              required: true,
            },
            resellerUserId: {
              type: Schema.Types.ObjectId,
              ref: "User",
              required: true,
            },
            newOwnerUserId: {
              type: Schema.Types.ObjectId,
              ref: "User",
              required: true,
            },
            newOwnerEmail: { type: String, required: true, lowercase: true, trim: true },
            resalePriceUSD: { type: Number, required: true, min: 0 },
            invoiceId: { type: Schema.Types.ObjectId, ref: "Invoice" },
            requestedAt: { type: Date },
            decidedAt: { type: Date },
            reassignmentId: {
              type: Schema.Types.ObjectId,
              ref: "FranchiseReassignment",
            },
          },
          { _id: false }
        ),
        default: null,
      },
      acquisitionType: {
        type: String,
        enum: ["original", "resale"],
        default: "original",
        index: true,
      },
      acquiredReassignmentId: {
        type: Schema.Types.ObjectId,
        ref: "FranchiseReassignment",
      },
      pendingResaleOffer: {
        type: new Schema<IPendingResaleOffer>(
          {
            offerId: {
              type: Schema.Types.ObjectId,
              ref: "FranchiseOffer",
              required: true,
            },
            buyerUserId: {
              type: Schema.Types.ObjectId,
              ref: "User",
              required: true,
            },
            buyerEmail: {
              type: String,
              required: true,
              lowercase: true,
              trim: true,
            },
            agreedPriceUSD: { type: Number, required: true, min: 0 },
            resaleInvoiceId: {
              type: Schema.Types.ObjectId,
              ref: "Invoice",
              required: true,
            },
            acceptedAt: { type: Date, required: true },
          },
          { _id: false },
        ),
        default: null,
      },
    },
    { timestamps: true, collection: "franchise_territory_assignments" }
  );

// One owner per geo entity per program. Cancelled rows keep the index slot,
// so reassignment (Phase 2) updates the existing doc rather than inserting.
FranchiseTerritoryAssignmentSchema.index(
  { programId: 1, geoLevel: 1, geoEntityId: 1 },
  { unique: true }
);
// Buyer-location matching at distribution time: find active assignments for a
// program quickly.
FranchiseTerritoryAssignmentSchema.index({ programId: 1, status: 1 });
FranchiseTerritoryAssignmentSchema.index({ ownerUserId: 1, status: 1 });

export const FranchiseTerritoryAssignment =
  model<IFranchiseTerritoryAssignment>(
    "FranchiseTerritoryAssignment",
    FranchiseTerritoryAssignmentSchema
  );
