// Per-organization conversion fee schedule.
//
// A founder of a crypto office prices each currency pair they convert
// across — e.g. INR -> USDT at 10%, INR -> BTC at 20%. The fee is
// charged by Garage inside `transferBetweenWallets`, in the same Mongo
// transaction as the conversion itself. That atomicity is the entire
// reason this lives here rather than in a caller: an earlier attempt
// sequenced "convert, then move the fee" as two calls from HiFi, and a
// failure between them meant the desk had converted for free with no
// way to unwind.
//
// One document per org — the founder edits a table and saves it whole,
// so a wholesale replace has no merge semantics to get wrong.
//
// Rates are stored in BASIS POINTS as integers. 10% is exactly 1000
// and no rounding argument can start; a float percent applied to a BTC
// amount is a bug waiting to happen.

import mongoose, { Schema, InferSchemaType, Model } from "mongoose";
import { TRANSFERABLE_CURRENCIES } from "../services/cryptoFxRate";

/** 50%. A typo'd 10000 would be a 100% fee — the customer converting
 *  would lose everything. Enforced server-side and echoed to the UI. */
export const MAX_FEE_BPS = 5000;

const PairSchema = new Schema(
  {
    fromCurrency: { type: String, enum: TRANSFERABLE_CURRENCIES, required: true },
    toCurrency: { type: String, enum: TRANSFERABLE_CURRENCIES, required: true },
    /** Basis points. 1000 = 10%. */
    feeBps: { type: Number, required: true, min: 0, max: MAX_FEE_BPS },
    isActive: { type: Boolean, default: true },
  },
  { _id: false },
);

const OrgConversionFeeSchema = new Schema(
  {
    orgId: {
      type: Schema.Types.ObjectId,
      ref: "Organization",
      required: true,
      unique: true,
      index: true,
    },
    /** Applied when no explicit pair row matches. 0 = free by default. */
    defaultFeeBps: { type: Number, default: 0, min: 0, max: MAX_FEE_BPS },

    /**
     * Percentage OF THE COLLECTED FEE routed through the Unilevel Plus
     * tree — the same engine founder products use. 50 means "half the
     * fee goes to the comp plan, half stays with the founder".
     *
     * A percentage of the FEE, not of the conversion. On a 2% fee over
     * a 100,000 INR conversion the fee is 2,000; at 50% the tree gets
     * 1,000 and the founder keeps 1,000.
     *
     * 0 (default) = no comp plan, the founder keeps the whole fee.
     */
    compPlanPercentage: { type: Number, default: 0, min: 0, max: 100 },
    /** Directional. INR->BTC says nothing about BTC->INR; a founder who
     *  wants both sets both. Uniqueness per direction is enforced in
     *  the service on write, since this is an embedded array. */
    pairs: { type: [PairSchema], default: [] },

    // A fee is a price. Someone will eventually ask who changed it.
    updatedBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
  },
  { timestamps: true, collection: "org_conversion_fees" },
);

export type IOrgConversionFee = InferSchemaType<typeof OrgConversionFeeSchema>;

export const OrgConversionFee: Model<IOrgConversionFee> =
  (mongoose.models.OrgConversionFee as Model<IOrgConversionFee>) ||
  mongoose.model<IOrgConversionFee>("OrgConversionFee", OrgConversionFeeSchema);
