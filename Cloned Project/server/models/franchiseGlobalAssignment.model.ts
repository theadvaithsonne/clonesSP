import { Schema, model, Document, Types } from "mongoose";

/**
 * A global-catalog franchise entity that has been sold to a Garage user via
 * the Garage invoice engine (System A — GaragePayFran). Mirrors
 * `FranchiseTerritoryAssignment` (System B) minus program/office context.
 *
 * Ownership and pricing live HERE. The upstream global catalog collections
 * (franchise_countries / franchise_territorymasters / franchise_sub_territories)
 * are owned by roam-admin-prod and Garage never writes them; territory
 * commission distribution reads THIS collection first and falls back to the
 * catalog's `ownerEmail` for legacy owners (pre-Garage-sale).
 *
 * Activation is payment-gated: the buyer's $650/yr invoice being PAID flips
 * status `pending_payment` → `active`. Subscription lapse flips
 * `active` → `paused_lapsed` — earnings pause and the slice cascades UP via
 * the chain-integrity planner (does NOT revert to catalog fallback).
 */

export type FranchiseGlobalStatus =
  | "listed"
  | "pending_payment"
  | "active"
  | "paused_lapsed"
  | "withdrawn"
  | "cancelled";

export type FranchiseGlobalGeoLevel = "country" | "territory" | "subTerritory";

export interface IFranchiseGlobalSubscription {
  invoiceId?: Types.ObjectId;
  startedAt?: Date;
  expiresAt?: Date;
  lastPaymentInvoiceId?: Types.ObjectId;
}

export type FranchiseGlobalReassignmentStatus =
  | "pending_approval"
  | "approved"
  | "rejected";

/**
 * Buyer→buyer resale. The current owner requests a reassignment to a new
 * owner at a resale price; platform admin must approve before the new owner
 * is billed. On payment of the resale invoice, ownership transfers and the
 * reseller is credited the markup over the $650 floor.
 */
export interface IPendingGlobalReassignment {
  status: FranchiseGlobalReassignmentStatus;
  resellerUserId: Types.ObjectId;
  newOwnerUserId: Types.ObjectId;
  newOwnerEmail: string;
  resalePriceUSD: number;
  invoiceId?: Types.ObjectId;
  requestedAt?: Date;
  decidedAt?: Date;
  reassignmentId?: Types.ObjectId;
}

export type FranchiseGlobalAcquisitionType = "original" | "resale";

/**
 * Lock held on a global assignment when the owner has accepted a
 * buyer-initiated resale offer and the buyer's prorated invoice is
 * awaiting payment. Presence blocks accepting further offers on the same
 * assignment. Cleared on payment (transfer completes) or on invoice
 * cancel / expire (offer + lock released manually or via TTL).
 */
export interface IPendingGlobalResaleOffer {
  offerId: Types.ObjectId;
  buyerUserId: Types.ObjectId;
  buyerEmail: string;
  agreedPriceUSD: number;
  resaleInvoiceId: Types.ObjectId;
  acceptedAt: Date;
}

/**
 * Owner-initiated directed sale. The current owner picks a specific buyer
 * email + resale price; a `franchise_global` invoice is minted for that
 * buyer. On payment the row transfers ownership, the seller receives the
 * excess over the $650 platform floor, and this sub-doc is cleared. Presence
 * blocks a second directed-sale (mirrors `pendingResaleOffer`'s lock).
 */
export interface IPendingGlobalDirectedSale {
  buyerUserId: Types.ObjectId;
  buyerEmail: string;
  priceUSD: number;
  invoiceId: Types.ObjectId;
  sentAt: Date;
}

export interface IFranchiseGlobalAssignment extends Document {
  _id: Types.ObjectId;

  geoLevel: FranchiseGlobalGeoLevel;
  geoEntityId: string;
  geoEntityName?: string;
  geoCountry?: string;
  geoParentTerritory?: string;
  zipCodes?: string[];

  // Optional: null while `status === "listed"` (pre-owner) or `"withdrawn"`.
  // Set at claim time and preserved through `pending_payment` → `active`.
  ownerUserId?: Types.ObjectId | null;
  ownerEmail?: string | null;

  // Historical purchase price — the amount the CURRENT owner paid to
  // acquire this entity. Never overwritten by a re-listing (that's what
  // `listedPriceUSD` is for). Fulfillment copies `listedPriceUSD` here
  // when a claim's invoice is paid, so this always reflects what the
  // current owner actually paid.
  priceUSD: number;
  soldByUserId?: Types.ObjectId;
  // Current resale asking price when the row is in `status: "listed"`.
  // Set by the listing endpoint (owner-resale or admin), updated by
  // PATCH /listings/:id, read by the claim handler to mint the invoice,
  // and copied → priceUSD + unset by fulfillment on successful claim.
  // Undefined when the row isn't currently listed.
  listedPriceUSD?: number | null;
  // Who created the current listing. Mirrors System B's
  // `assignedByUserId` — cached on the row so the fulfillment handler can
  // credit them on claim without a lookup. Populated on transition to
  // `listed`; unchanged thereafter (survives `active`).
  listedByUserId?: Types.ObjectId | null;

  status: FranchiseGlobalStatus;
  subscription: IFranchiseGlobalSubscription;
  pendingReassignment?: IPendingGlobalReassignment | null;
  // Set when the owner accepts a buyer-initiated resale offer; cleared on
  // resale invoice payment / cancel / expiry. Presence blocks accepting
  // further offers on the same assignment.
  pendingResaleOffer?: IPendingGlobalResaleOffer | null;
  // Owner-initiated directed sale to a specific email. Set at
  // `POST /assignments/:id/directed-sale`, cleared on invoice paid/cancel.
  pendingDirectedSale?: IPendingGlobalDirectedSale | null;

  acquisitionType: FranchiseGlobalAcquisitionType;
  acquiredReassignmentId?: Types.ObjectId;

  createdAt: Date;
  updatedAt: Date;
}

const GlobalSubscriptionSchema = new Schema<IFranchiseGlobalSubscription>(
  {
    invoiceId: { type: Schema.Types.ObjectId, ref: "Invoice" },
    startedAt: { type: Date },
    expiresAt: { type: Date },
    lastPaymentInvoiceId: { type: Schema.Types.ObjectId, ref: "Invoice" },
  },
  { _id: false }
);

const FranchiseGlobalAssignmentSchema = new Schema<IFranchiseGlobalAssignment>(
  {
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

    ownerUserId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: false,
      index: true,
    },
    ownerEmail: { type: String, required: false, trim: true, lowercase: true },

    priceUSD: { type: Number, required: true, min: 0 },
    soldByUserId: { type: Schema.Types.ObjectId, ref: "User" },
    listedPriceUSD: { type: Number, required: false, min: 0, default: null },
    listedByUserId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: false,
      index: true,
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
      type: GlobalSubscriptionSchema,
      default: () => ({}),
    },
    pendingReassignment: {
      type: new Schema<IPendingGlobalReassignment>(
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
          newOwnerEmail: {
            type: String,
            required: true,
            lowercase: true,
            trim: true,
          },
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
      type: new Schema<IPendingGlobalResaleOffer>(
        {
          offerId: {
            type: Schema.Types.ObjectId,
            ref: "FranchiseGlobalOffer",
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
    pendingDirectedSale: {
      type: new Schema<IPendingGlobalDirectedSale>(
        {
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
          priceUSD: { type: Number, required: true, min: 0 },
          invoiceId: {
            type: Schema.Types.ObjectId,
            ref: "Invoice",
            required: true,
          },
          sentAt: { type: Date, required: true },
        },
        { _id: false },
      ),
      default: null,
    },
  },
  { timestamps: true, collection: "franchise_global_assignments" }
);

// One owner per geo entity in the global catalog. Cancelled rows keep the
// index slot so resale (Phase 2) mutates the existing doc rather than
// inserting.
FranchiseGlobalAssignmentSchema.index(
  { geoLevel: 1, geoEntityId: 1 },
  { unique: true }
);
FranchiseGlobalAssignmentSchema.index({ ownerUserId: 1, status: 1 });
FranchiseGlobalAssignmentSchema.index({ status: 1, "subscription.expiresAt": 1 });

export const FranchiseGlobalAssignment = model<IFranchiseGlobalAssignment>(
  "FranchiseGlobalAssignment",
  FranchiseGlobalAssignmentSchema
);
