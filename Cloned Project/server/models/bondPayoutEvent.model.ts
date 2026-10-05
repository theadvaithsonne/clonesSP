// One scheduled interest payment for one holding (spec §4, §8).
//
// Every event is pre-created at purchase time, BEFORE any money moves,
// and carries a unique `dedupeKey` of holdingId + sequenceNo. That
// unique index is the entire safety mechanism for the payout engine:
// this backend has no cron library and no leader election — jobs are
// plain `setInterval`s in src/index.ts, so two instances WILL run the
// same tick concurrently. Correctness rests on the database refusing
// the second write. The index is not optional.

import mongoose, { Schema, InferSchemaType, Model } from "mongoose";
import { BOND_CURRENCIES } from "../config/bondMoney";

export const BOND_PAYOUT_EVENT_STATUSES = [
  "scheduled",
  "paid",
  "failed",
  "skipped",
] as const;

const BondPayoutEventSchema = new Schema(
  {
    holdingId: { type: Schema.Types.ObjectId, ref: "BondHolding", required: true, index: true },
    instrumentId: { type: Schema.Types.ObjectId, ref: "BondInstrument", required: true, index: true },
    orgId: { type: Schema.Types.ObjectId, ref: "Organization", required: true },
    buyerUserId: { type: Schema.Types.ObjectId, ref: "User", required: true },

    /** 1-based position in this holding's schedule. */
    sequenceNo: { type: Number, required: true, min: 1 },
    dueAt: { type: Date, required: true },

    currency: { type: String, enum: BOND_CURRENCIES, required: true },
    /** units x per-unit payout, rounded per unit first (spec §8). */
    interestAtomic: { type: String, required: true },
    /** Commission pool for THIS payout date, 0 when basis excludes payout. */
    commissionAtomic: { type: String, default: "0" },

    status: {
      type: String,
      enum: BOND_PAYOUT_EVENT_STATUSES,
      default: "scheduled",
    },
    attempts: { type: Number, default: 0 },
    lastError: { type: String, default: null },
    paidAt: { type: Date, default: null },

    walletTransactionId: { type: Schema.Types.ObjectId, default: null },
    /**
     * USD value of this payment AT THE MOMENT IT WAS PAID, and the rate
     * used. Recorded so the public bond page can show what a payment was
     * actually worth, not just its value at today's rate. Null on events
     * paid before this was recorded, and whenever the price feed was
     * unavailable — a missing rate must never block a payout.
     */
    usdAtPayment: { type: Number, default: null },
    usdRateAtPayment: { type: Number, default: null },
    commissionDistributionId: { type: Schema.Types.ObjectId, default: null },

    /** "bond_payout_<holdingId>_<sequenceNo>" — see header. */
    dedupeKey: { type: String, required: true },
  },
  { timestamps: true, collection: "bond_payout_events" },
);

// THE safety index. A concurrent duplicate tick must fail here.
BondPayoutEventSchema.index({ dedupeKey: 1 }, { unique: true });
// The scheduler's only hot query.
BondPayoutEventSchema.index({ status: 1, dueAt: 1 });

export type IBondPayoutEvent = InferSchemaType<typeof BondPayoutEventSchema>;

export const BondPayoutEvent: Model<IBondPayoutEvent> =
  (mongoose.models.BondPayoutEvent as Model<IBondPayoutEvent>) ||
  mongoose.model<IBondPayoutEvent>("BondPayoutEvent", BondPayoutEventSchema);
