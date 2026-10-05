// One investor's position in a bond (spec §9 `holding`).
//
// ONE ROW PER PURCHASE. Partial redemption is not supported in v1 — the
// spec (§8) warns that supporting it requires unit-level rows and that
// migrating later is painful, so if that decision flips this model has
// to change shape rather than gain a field. See HIFI_BONDS_PLAN.md O2.
//
// Amounts are atomic integer strings — see config/bondMoney.ts.

import mongoose, { Schema, InferSchemaType, Model } from "mongoose";
import { BOND_CURRENCIES } from "../config/bondMoney";
import { generateBondHash } from "../services/bondHash";

/** Spec §9: pending_payment -> active -> (payout_failed <-> active)
 *  -> matured -> redeemed, plus cancelled before Day 0 completes. */
export const BOND_HOLDING_STATUSES = [
  "pending_payment",
  "active",
  "payout_failed",
  "matured",
  "redeemed",
  "cancelled",
] as const;

const BondHoldingSchema = new Schema(
  {
    instrumentId: { type: Schema.Types.ObjectId, ref: "BondInstrument", required: true, index: true },
    /**
     * Public, non-guessable identifier — the "bond hash" shown on the
     * public bond page and in share links. See services/bondHash.ts.
     * The default covers every creation path; fulfillment also sets it
     * explicitly so it can retry on the (astronomically unlikely)
     * collision.
     */
    bondHash: { type: String, default: generateBondHash },
    buyerUserId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    orgId: { type: Schema.Types.ObjectId, ref: "Organization", required: true, index: true },

    units: { type: Number, required: true, min: 1 },
    currency: { type: String, enum: BOND_CURRENCIES, required: true },
    /** units x unitPrice, at purchase time. */
    principalAtomic: { type: String, required: true },
    /** Snapshot of the per-unit payout so a later instrument edit can
     *  never change what this holding is owed. */
    payoutAmountPerUnitAtomic: { type: String, required: true },
    payoutCount: { type: Number, required: true },

    invoiceId: { type: Schema.Types.ObjectId, ref: "Invoice", default: null },

    status: {
      type: String,
      enum: BOND_HOLDING_STATUSES,
      default: "pending_payment",
      index: true,
    },

    purchasedAt: { type: Date, default: null },
    maturesAt: { type: Date, default: null },
    /** Driven off bond_payout_events; denormalised for cheap listing. */
    nextPayoutAt: { type: Date, default: null },
    payoutsCompleted: { type: Number, default: 0 },

    redeemedAt: { type: Date, default: null },
    /** WalletTransaction id of the principal return. */
    redemptionTxId: { type: Schema.Types.ObjectId, default: null },
    /** True when returned by the auto-redeem sweep rather than a tap. */
    autoRedeemed: { type: Boolean, default: false },

    lastPayoutError: { type: String, default: null },
  },
  { timestamps: true, collection: "bond_holdings" },
);

// One invoice can only ever produce one holding. Partial so the many
// pre-payment rows with invoiceId:null don't collide. This is a DB
// guarantee, not an application promise — fulfillInvoice can be
// re-entered by a retry or a reconcile sweep.
BondHoldingSchema.index(
  { invoiceId: 1 },
  { unique: true, partialFilterExpression: { invoiceId: { $type: "objectId" } } },
);

// Public lookup by bond hash, and its uniqueness guarantee. Partial
// so any row that predates the field can't collide on a missing value.
// NOTE: autoIndex is OFF in production (see db/mongo.ts) — this index
// is created by the bond-hash backfill / `npm run indexes:sync`, not
// on deploy.
BondHoldingSchema.index(
  { bondHash: 1 },
  { unique: true, partialFilterExpression: { bondHash: { $type: "string" } } },
);

// Investor's portfolio view.
BondHoldingSchema.index({ buyerUserId: 1, orgId: 1, createdAt: -1 });
// Auto-redeem sweep (spec §8 "unredeemed at maturity").
BondHoldingSchema.index({ status: 1, maturesAt: 1 });

export type IBondHolding = InferSchemaType<typeof BondHoldingSchema>;

export const BondHolding: Model<IBondHolding> =
  (mongoose.models.BondHolding as Model<IBondHolding>) ||
  mongoose.model<IBondHolding>("BondHolding", BondHoldingSchema);
