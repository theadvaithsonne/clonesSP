import { Schema, model, Document, Types } from "mongoose";

/**
 * Persistent resale (buyer→buyer reassignment) ledger.
 *
 * The assignment doc's `pendingReassignment` only holds the CURRENT in-flight
 * request and is wiped to null once the resale completes — so it can't answer
 * "show me the history of all resales". This collection records every
 * reassignment as a durable row that moves through its lifecycle:
 *
 *   pending_approval → approved → completed
 *                    ↘ rejected / cancelled
 *
 * One row per request. A territory that's resold twice has two rows. Each row
 * keeps the from/to owners, price, invoice, and timestamps, so the founder can
 * audit the full chain of custody for a territory.
 */

export type FranchiseReassignmentStatus =
  | "pending_approval"
  | "approved"
  | "rejected"
  | "completed"
  | "cancelled";

export interface IFranchiseReassignment extends Document {
  _id: Types.ObjectId;
  programId: Types.ObjectId;
  officeId: Types.ObjectId;
  assignmentId: Types.ObjectId;

  // Denormalized territory info for display without a join.
  geoLevel: string;
  geoEntityId: string;
  geoEntityName?: string;

  // Parties.
  resellerUserId: Types.ObjectId; // the owner who is selling (== fromOwner)
  resellerEmail?: string;
  fromOwnerUserId: Types.ObjectId; // owner at request time
  fromOwnerEmail?: string;
  newOwnerUserId: Types.ObjectId;
  newOwnerEmail: string;

  resalePriceUSD: number;

  status: FranchiseReassignmentStatus;
  invoiceId?: Types.ObjectId; // set at founder approval

  requestedAt: Date;
  decidedAt?: Date; // approve / reject time
  completedAt?: Date; // payment / transfer time

  createdAt: Date;
  updatedAt: Date;
}

const FranchiseReassignmentSchema = new Schema<IFranchiseReassignment>(
  {
    programId: { type: Schema.Types.ObjectId, ref: "FranchiseProgram", required: true, index: true },
    officeId: { type: Schema.Types.ObjectId, ref: "Organization", required: true, index: true },
    assignmentId: {
      type: Schema.Types.ObjectId,
      ref: "FranchiseTerritoryAssignment",
      required: true,
      index: true,
    },

    geoLevel: { type: String, required: true },
    geoEntityId: { type: String, required: true, index: true },
    geoEntityName: { type: String },

    resellerUserId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    resellerEmail: { type: String, lowercase: true, trim: true },
    fromOwnerUserId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    fromOwnerEmail: { type: String, lowercase: true, trim: true },
    newOwnerUserId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    newOwnerEmail: { type: String, required: true, lowercase: true, trim: true },

    resalePriceUSD: { type: Number, required: true, min: 0 },

    status: {
      type: String,
      enum: ["pending_approval", "approved", "rejected", "completed", "cancelled"],
      default: "pending_approval",
      required: true,
      index: true,
    },
    invoiceId: { type: Schema.Types.ObjectId, ref: "Invoice" },

    requestedAt: { type: Date, required: true },
    decidedAt: { type: Date },
    completedAt: { type: Date },
  },
  { timestamps: true, collection: "franchise_reassignments" }
);

// History queries: per-program newest-first, optionally filtered by status.
FranchiseReassignmentSchema.index({ programId: 1, createdAt: -1 });
FranchiseReassignmentSchema.index({ programId: 1, status: 1, createdAt: -1 });
// "My resales" — as reseller or as new owner.
FranchiseReassignmentSchema.index({ resellerUserId: 1, createdAt: -1 });
FranchiseReassignmentSchema.index({ newOwnerUserId: 1, createdAt: -1 });

export const FranchiseReassignment = model<IFranchiseReassignment>(
  "FranchiseReassignment",
  FranchiseReassignmentSchema
);
