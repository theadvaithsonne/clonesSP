// A HiFi bond an office founder has issued (spec §2 + §3).
//
// Crypto offices only — every route that touches this asserts
// `Organization.officeCreatedFromCryptobrand === true`.
//
// All money is an INTEGER count of the currency's smallest unit, stored
// as a STRING and handled with BigInt (see config/bondMoney.ts). Never
// a float: wallet balances already drift, and a daily bond compounds it.
//
// `derived` is denormalised at publish time on purpose. A founder must
// not be able to edit a plan and retroactively change what existing
// holdings are owed, so live obligations are computed from the snapshot
// taken when the instrument went live, not from current inputs.

import mongoose, { Schema, InferSchemaType, Model } from "mongoose";
import { BOND_CURRENCIES } from "../config/bondMoney";
import { PAYOUT_FREQUENCIES } from "../services/bondMath";

export const BOND_INSTRUMENT_STATUSES = [
  "draft",
  "published",
  "fully_subscribed",
  "closed",
] as const;

export const COMMISSION_BASES = [
  "principal",
  "payout",
  "both",
  "none",
] as const;

/** Atomic-amount field: an integer in the currency's smallest unit,
 *  carried as a string so ETH/wei survives. */
const atomic = { type: String, required: true, default: "0" };

const DerivedSchema = new Schema(
  {
    // per unit (spec §3)
    payoutAmountPerUnitAtomic: atomic,
    payoutCount: { type: Number, required: true },
    totalInterestPerUnitAtomic: atomic,
    principalCommissionPerUnitAtomic: atomic,
    payoutCommissionPerPayoutPerUnitAtomic: atomic,
    totalCommissionPerUnitAtomic: atomic,
    totalOutflowPerUnitAtomic: atomic,
    /** Signed — negative when the seller pays out more than they raise. */
    sellerNetPerUnitAtomic: { type: String, required: true },

    // at full subscription (spec §7)
    totalRaiseAtomic: atomic,
    totalInterestAtFullAtomic: atomic,
    totalCommissionAtFullAtomic: atomic,
    totalOutflowAtFullAtomic: atomic,
    sellerNetAtFullAtomic: { type: String, required: true },

    annualisedRatePct: { type: String, required: true },
    stubDays: { type: Number, default: 0 },
  },
  { _id: false },
);

const BondInstrumentSchema = new Schema(
  {
    orgId: { type: Schema.Types.ObjectId, ref: "Organization", required: true, index: true },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
    name: { type: String, required: true, trim: true },
    description: { type: String, default: "" },

    status: {
      type: String,
      enum: BOND_INSTRUMENT_STATUSES,
      default: "draft",
      index: true,
    },

    // ---- seller-defined (spec §2) ----
    unitPriceAtomic: atomic,
    currency: { type: String, enum: BOND_CURRENCIES, required: true },
    durationDays: { type: Number, required: true, min: 1 },
    payoutFrequency: { type: String, enum: PAYOUT_FREQUENCIES, required: true },
    /** Percent PER PAYOUT EVENT — never annualised. Spec §8 is explicit
     *  that calling this IRR will get it divided by 365 by someone. */
    ratePerPayoutPeriod: { type: String, required: true },
    totalUnits: { type: Number, required: true, min: 1 },
    minUnits: { type: Number, required: true, min: 1, default: 1 },
    unitsSold: { type: Number, default: 0, min: 0 },

    commissionBasis: { type: String, enum: COMMISSION_BASES, default: "none" },
    /** Percent of unit price, charged once at purchase. */
    principalCommissionRate: { type: String, default: "0" },
    /** Percent of the PAYOUT AMOUNT, charged on each payout date.
     *  Decision D2 — deliberately a separate field from the principal
     *  rate, because one `commission_rate` reads two ways that differ
     *  by 100x (spec §6). */
    payoutCommissionRate: { type: String, default: "0" },

    /** Comp plan that splits the commission pool. `levels` or
     *  `unilevel_plus` — the bond engine never splits it itself. */
    combPlanId: { type: Schema.Types.ObjectId, ref: "CombPlan", default: null },

    derived: { type: DerivedSchema, required: true },

    /** The exact total-outflow figure the founder acknowledged at
     *  publish. Spec §7 wants a hard confirmation, not a generic
     *  "I agree" — storing it proves which number they saw. */
    acknowledgedOutflowAtomic: { type: String, default: null },

    publishedAt: { type: Date, default: null },
    closedAt: { type: Date, default: null },
  },
  { timestamps: true, collection: "bond_instruments" },
);

// Founder's list view.
BondInstrumentSchema.index({ orgId: 1, status: 1, createdAt: -1 });
// Investor-facing browse of what's open.
BondInstrumentSchema.index({ status: 1, currency: 1 });

export type IBondInstrument = InferSchemaType<typeof BondInstrumentSchema>;

export const BondInstrument: Model<IBondInstrument> =
  (mongoose.models.BondInstrument as Model<IBondInstrument>) ||
  mongoose.model<IBondInstrument>("BondInstrument", BondInstrumentSchema);
