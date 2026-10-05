import mongoose, { Schema, Document, Types } from "mongoose";

/**
 * A bill raised at a store counter (the Garage IRL seller app's "New bill").
 *
 * This is the SELLER's record of the bill. It is not a payment: sending a bill
 * creates an ordinary ecommerce invoice (services/ecommerceInvoice.ts), so
 * payment, GST, coupons, commissions, stock and the store-order mirror all run
 * exactly as they do for any other checkout. What a bill adds on top is the
 * part of a counter sale that exists before and around that invoice:
 *
 *   - a draft the seller can leave and come back to,
 *   - the table or counter and the number of guests,
 *   - a customer attached by scanning the bill's QR before it is sent,
 *   - service charge / packaging, and "amount only" bills with no catalogue item,
 *   - a correction the customer can request, and a split across several payers.
 *
 * Money is in paise (INR smallest unit) throughout, like invoice amounts.
 */

export const COUNTER_BILL_STATUSES = [
  "draft",
  "sent",
  "paid",
  "cancelled",
  "expired",
  "refunded",
] as const;
export type CounterBillStatus = (typeof COUNTER_BILL_STATUSES)[number];

export interface ICounterBillAddOn {
  label: string;
  /** paise, per unit of the line — resolved from the product, never the client */
  price: number;
}

export interface ICounterBillLine {
  productId: Types.ObjectId;
  variantId?: Types.ObjectId;
  /** snapshot for the list and the draft editor; the invoice re-reads the product */
  title: string;
  variantTitle?: string;
  image?: string;
  diet?: string | null;
  /** paise, base price per unit before add-ons (snapshot; repriced on send) */
  unitPrice: number;
  quantity: number;
  addOns: ICounterBillAddOn[];
}

export interface ICounterBillCustomer {
  userId?: Types.ObjectId;
  name?: string;
  phone?: string;
  email?: string;
  attachedAt?: Date;
  /** how they were attached — scanning the bill's QR, or typed in by the seller */
  via?: "qr" | "manual";
}

export interface ICounterBillShare {
  index: number;
  amount: number; // paise
  invoiceId?: Types.ObjectId;
  payUrl?: string;
  status: "pending" | "paid" | "cancelled";
  paidAt?: Date;
  userId?: Types.ObjectId;
}

export interface ICounterBillCorrection {
  status: "requested" | "resolved";
  note?: string;
  requestedAt: Date;
  requestedBy?: Types.ObjectId;
  resolvedAt?: Date;
}

export interface ICounterBillTotals {
  itemTotal: number;
  serviceCharge: number;
  packaging: number;
  tax: number;
  discount: number;
  total: number;
}

export interface ICounterBill extends Document {
  _id: Types.ObjectId;
  orgId: Types.ObjectId;
  storeId?: Types.ObjectId;
  /** store-backend branch the bill was raised at; name snapshotted for lists */
  branchId?: Types.ObjectId;
  branchName?: string;
  createdBy: Types.ObjectId;
  billNumber: number;
  mode: "itemised" | "amount";
  /** "Table 14", "Counter" — free text so it works for any trade */
  table?: string;
  guests?: number;
  lines: ICounterBillLine[];
  /** paise — the whole bill in "amount only" mode */
  amount?: number;
  amountLabel?: string;
  serviceChargePct: number;
  packaging: number;
  couponCode?: string;
  note?: string;
  status: CounterBillStatus;
  /** short code the bill's QR carries; cleared once the bill can't be claimed */
  attachCode?: string;
  customer?: ICounterBillCustomer;
  invoiceId?: Types.ObjectId;
  invoiceNumber?: string;
  payUrl?: string;
  expiresAt?: Date;
  totals: ICounterBillTotals;
  split?: { ways: number; shares: ICounterBillShare[] };
  correction?: ICounterBillCorrection;
  sentAt?: Date;
  paidAt?: Date;
  cancelledAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const AddOnSchema = new Schema<ICounterBillAddOn>(
  {
    label: { type: String, required: true, trim: true, maxlength: 80 },
    price: { type: Number, required: true, min: 0 },
  },
  { _id: false }
);

const LineSchema = new Schema<ICounterBillLine>(
  {
    productId: { type: Schema.Types.ObjectId, required: true },
    variantId: { type: Schema.Types.ObjectId },
    title: { type: String, required: true, trim: true, maxlength: 200 },
    variantTitle: { type: String, trim: true, maxlength: 120 },
    image: { type: String, maxlength: 2048 },
    diet: { type: String, default: null },
    unitPrice: { type: Number, required: true, min: 0 },
    quantity: { type: Number, required: true, min: 1, max: 999 },
    addOns: { type: [AddOnSchema], default: [] },
  },
  { _id: false }
);

const ShareSchema = new Schema<ICounterBillShare>(
  {
    index: { type: Number, required: true },
    amount: { type: Number, required: true, min: 0 },
    invoiceId: { type: Schema.Types.ObjectId },
    payUrl: { type: String },
    status: {
      type: String,
      enum: ["pending", "paid", "cancelled"],
      default: "pending",
    },
    paidAt: { type: Date },
    userId: { type: Schema.Types.ObjectId },
  },
  { _id: false }
);

const CounterBillSchema = new Schema<ICounterBill>(
  {
    orgId: { type: Schema.Types.ObjectId, required: true },
    storeId: { type: Schema.Types.ObjectId },
    branchId: { type: Schema.Types.ObjectId },
    branchName: { type: String, trim: true, maxlength: 160 },
    createdBy: { type: Schema.Types.ObjectId, required: true },
    billNumber: { type: Number, required: true },
    mode: { type: String, enum: ["itemised", "amount"], default: "itemised" },
    table: { type: String, trim: true, maxlength: 40 },
    guests: { type: Number, min: 1, max: 99 },
    lines: { type: [LineSchema], default: [] },
    amount: { type: Number, min: 0 },
    amountLabel: { type: String, trim: true, maxlength: 120 },
    serviceChargePct: { type: Number, min: 0, max: 30, default: 0 },
    packaging: { type: Number, min: 0, default: 0 },
    couponCode: { type: String, trim: true, uppercase: true, maxlength: 20 },
    note: { type: String, trim: true, maxlength: 500 },
    status: {
      type: String,
      enum: COUNTER_BILL_STATUSES,
      default: "draft",
    },
    attachCode: { type: String },
    customer: {
      userId: { type: Schema.Types.ObjectId },
      name: { type: String, trim: true, maxlength: 120 },
      phone: { type: String, trim: true, maxlength: 20 },
      email: { type: String, trim: true, lowercase: true, maxlength: 200 },
      attachedAt: { type: Date },
      via: { type: String, enum: ["qr", "manual"] },
    },
    invoiceId: { type: Schema.Types.ObjectId },
    invoiceNumber: { type: String },
    payUrl: { type: String },
    expiresAt: { type: Date },
    totals: {
      itemTotal: { type: Number, default: 0 },
      serviceCharge: { type: Number, default: 0 },
      packaging: { type: Number, default: 0 },
      tax: { type: Number, default: 0 },
      discount: { type: Number, default: 0 },
      total: { type: Number, default: 0 },
    },
    split: {
      ways: { type: Number, min: 2, max: 20 },
      shares: { type: [ShareSchema], default: undefined },
    },
    correction: {
      status: { type: String, enum: ["requested", "resolved"] },
      note: { type: String, trim: true, maxlength: 500 },
      requestedAt: { type: Date },
      requestedBy: { type: Schema.Types.ObjectId },
      resolvedAt: { type: Date },
    },
    sentAt: { type: Date },
    paidAt: { type: Date },
    cancelledAt: { type: Date },
  },
  { timestamps: true }
);

// The seller's list: newest first within a store, optionally one branch.
CounterBillSchema.index({ orgId: 1, createdAt: -1 });
CounterBillSchema.index({ orgId: 1, status: 1, createdAt: -1 });
CounterBillSchema.index({ orgId: 1, billNumber: 1 }, { unique: true });
// The QR → bill lookup. Sparse because the code is cleared once a bill can no
// longer be claimed, and unique so two live bills never share one.
CounterBillSchema.index({ attachCode: 1 }, { unique: true, sparse: true });
// The buyer's "bills for you".
CounterBillSchema.index({ "customer.userId": 1, createdAt: -1 });
CounterBillSchema.index({ invoiceId: 1 }, { sparse: true });
CounterBillSchema.index({ "split.shares.invoiceId": 1 }, { sparse: true });

export const CounterBill = mongoose.model<ICounterBill>(
  "CounterBill",
  CounterBillSchema
);

/**
 * Per-store bill numbers. An atomic $inc on one row per org, so two tills
 * raising a bill in the same instant still get distinct numbers.
 */
const CounterBillSequenceSchema = new Schema({
  orgId: { type: Schema.Types.ObjectId, required: true, unique: true },
  seq: { type: Number, default: 0 },
});

export const CounterBillSequence = mongoose.model(
  "CounterBillSequence",
  CounterBillSequenceSchema
);

export async function nextCounterBillNumber(
  orgId: Types.ObjectId | string
): Promise<number> {
  const row = await CounterBillSequence.findOneAndUpdate(
    { orgId: new Types.ObjectId(String(orgId)) },
    { $inc: { seq: 1 } },
    { new: true, upsert: true }
  ).lean();
  return (row as any).seq as number;
}
