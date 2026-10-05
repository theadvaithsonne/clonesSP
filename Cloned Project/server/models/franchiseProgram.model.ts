import { Schema, model, Document, Types } from "mongoose";

/**
 * A founder-run franchise program, scoped to ONE office (organization).
 *
 * This is the founder's *own* franchise layer — independent of the global
 * Shorupan franchise system (franchise_countries / franchise_territorymasters
 * / franchise_sub_territories, which are read-only mirrors owned by
 * roam-admin-prod). Both layers run on the same sale: the global system still
 * splits Shorupan's 5% platform fee; this program additionally carves the
 * founder-configured percentages out of the *office's seller-gross* and routes
 * them to the territory owners the founder sold to.
 *
 * One program per office (unique `officeId`). The founder pays a yearly
 * subscription ($650 by default) to keep the program active; lapse pauses
 * commission earning for the program's territory owners (the slice reverts to
 * the founder) until renewed.
 *
 * Commission attribution is **buyer-location based**: on each sale the buyer's
 * address resolves to a geo leaf, and the assignment covering that leaf earns.
 * (Contrast with the global system, which attributes by the seller-office
 * location.)
 */

/**
 * Yearly franchise subscription price (USD). Fixed business rule: the founder
 * pays this to opt in, and it's the floor a territory buyer pays (custom
 * prices may exceed it, with the excess going to the founder). Single source
 * of truth — used by the routes and invoice fulfilment.
 */
export const FRANCHISE_PRICE_USD = 650;

export type FranchiseProgramStatus =
  | "pending_payment"
  | "active"
  | "suspended"
  | "cancelled";

export interface IFranchiseProgramCommissionConfig {
  country: number;
  territory: number;
  subTerritory: number;
}

export interface IFranchiseProgramSubscription {
  priceUSD: number;
  period: "yearly";
  invoiceId?: Types.ObjectId;
  startedAt?: Date;
  expiresAt?: Date;
  lastPaymentInvoiceId?: Types.ObjectId;
}

export interface IFranchiseProgram extends Document {
  _id: Types.ObjectId;
  officeId: Types.ObjectId;
  founderUserId: Types.ObjectId;
  currency: string;
  status: FranchiseProgramStatus;
  commissionConfig: IFranchiseProgramCommissionConfig;
  subscription: IFranchiseProgramSubscription;
  createdAt: Date;
  updatedAt: Date;
}

const CommissionConfigSchema = new Schema<IFranchiseProgramCommissionConfig>(
  {
    // Percentages of the office's seller-gross. Founder-set, no fixed cap —
    // the distributor guards against overspending the office's wallet.
    country: { type: Number, default: 0, min: 0, max: 100 },
    territory: { type: Number, default: 0, min: 0, max: 100 },
    subTerritory: { type: Number, default: 0, min: 0, max: 100 },
  },
  { _id: false }
);

const SubscriptionSchema = new Schema<IFranchiseProgramSubscription>(
  {
    priceUSD: { type: Number, required: true, default: 650, min: 0 },
    period: { type: String, enum: ["yearly"], default: "yearly" },
    invoiceId: { type: Schema.Types.ObjectId, ref: "Invoice" },
    startedAt: { type: Date },
    expiresAt: { type: Date },
    lastPaymentInvoiceId: { type: Schema.Types.ObjectId, ref: "Invoice" },
  },
  { _id: false }
);

const FranchiseProgramSchema = new Schema<IFranchiseProgram>(
  {
    officeId: {
      type: Schema.Types.ObjectId,
      ref: "Organization",
      required: true,
      unique: true,
      index: true,
    },
    founderUserId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    currency: { type: String, default: "USD" },
    status: {
      type: String,
      enum: ["pending_payment", "active", "suspended", "cancelled"],
      default: "pending_payment",
      index: true,
    },
    commissionConfig: {
      type: CommissionConfigSchema,
      default: () => ({ country: 0, territory: 0, subTerritory: 0 }),
    },
    subscription: {
      type: SubscriptionSchema,
      default: () => ({ priceUSD: 650, period: "yearly" }),
    },
  },
  { timestamps: true, collection: "franchise_programs" }
);

export const FranchiseProgram = model<IFranchiseProgram>(
  "FranchiseProgram",
  FranchiseProgramSchema
);
