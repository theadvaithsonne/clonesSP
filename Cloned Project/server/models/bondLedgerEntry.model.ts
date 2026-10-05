// Append-only audit of every bond money movement.
//
// WalletTransaction already records the wallet side, but it is
// per-wallet and knows nothing about bonds. This is the bond-shaped
// view: which instrument, which holding, which payout sequence, and the
// exact atomic amount before any float conversion at the wallet edge.
//
// Never updated in place — a reversal is a new row referencing the
// original via `reversesEntryId`.

import mongoose, { Schema, InferSchemaType, Model } from "mongoose";
import { BOND_CURRENCIES } from "../config/bondMoney";

export const BOND_LEDGER_KINDS = [
  "purchase_debit", // buyer -> seller, principal
  "purchase_credit", // seller receives principal
  "principal_commission", // pool at purchase
  "payout_debit", // seller -> buyer, interest
  "payout_credit", // buyer receives interest
  "payout_commission", // pool on a payout date
  "redemption_debit", // seller -> buyer, principal back
  "redemption_credit",
  "reversal", // auto-reversal of a debit whose credit failed
] as const;

const BondLedgerEntrySchema = new Schema(
  {
    kind: { type: String, enum: BOND_LEDGER_KINDS, required: true, index: true },

    instrumentId: { type: Schema.Types.ObjectId, ref: "BondInstrument", required: true, index: true },
    holdingId: { type: Schema.Types.ObjectId, ref: "BondHolding", default: null, index: true },
    payoutEventId: { type: Schema.Types.ObjectId, ref: "BondPayoutEvent", default: null },
    orgId: { type: Schema.Types.ObjectId, ref: "Organization", required: true, index: true },

    fromUserId: { type: Schema.Types.ObjectId, ref: "User", default: null },
    toUserId: { type: Schema.Types.ObjectId, ref: "User", default: null },

    currency: { type: String, enum: BOND_CURRENCIES, required: true },
    /** Exact atomic amount — the authoritative figure. */
    amountAtomic: { type: String, required: true },
    /** What was actually handed to the float-based wallet layer, so a
     *  later reconciliation can spot edge-level drift. */
    walletAmount: { type: Number, default: null },

    /** Commission only: pool converted to USD for the comp-plan engines,
     *  plus the rate used. Commission distribution is USD-only today. */
    poolUsd: { type: Number, default: null },
    fxRateToUsd: { type: Number, default: null },

    walletTransactionId: { type: Schema.Types.ObjectId, default: null },
    reversesEntryId: { type: Schema.Types.ObjectId, ref: "BondLedgerEntry", default: null },

    note: { type: String, default: null },
  },
  { timestamps: true, collection: "bond_ledger_entries" },
);

// Org-scoped ledger view, mirroring the hifi transactions endpoint.
BondLedgerEntrySchema.index({ orgId: 1, createdAt: -1 });
BondLedgerEntrySchema.index({ holdingId: 1, createdAt: 1 });

export type IBondLedgerEntry = InferSchemaType<typeof BondLedgerEntrySchema>;

export const BondLedgerEntry: Model<IBondLedgerEntry> =
  (mongoose.models.BondLedgerEntry as Model<IBondLedgerEntry>) ||
  mongoose.model<IBondLedgerEntry>("BondLedgerEntry", BondLedgerEntrySchema);
