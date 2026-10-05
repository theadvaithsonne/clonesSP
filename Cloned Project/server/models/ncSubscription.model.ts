// src/models/ncSubscription.model.ts
// Read-only mirror of NetworkChains' recurring platform subscription. NC owns
// the `networkchain_subscriptions` collection (defined in contacts-backend as
// model "NetworkChainSubscription"); both backends share the same Mongo cluster
// (same pattern as NcWallet on `wallets`), so Garage opens its own Mongoose
// handle to read it — used only to derive `User.typeFlags.networkChainsSub`.
//
// Source of truth: contacts-backend/src/models/subscription.model.ts
// Keep field set in sync with that file.

import mongoose, { Schema, Document, Types } from "mongoose";

export interface INcSubscriptionPayment {
  paymentId: string;
  orderId: string;
  amountCents: number; // GST-inclusive; the $0 combo free-first-month is 0
  paidAt: Date;
}

export interface INcSubscription extends Document {
  _id: Types.ObjectId;
  userId: Types.ObjectId;
  orgId: Types.ObjectId;
  status: "active" | "expired" | "canceled";
  priceCents: number; // defaults to 4248 even for combo-only users — do NOT use to detect real payers
  currentPeriodStart: Date;
  currentPeriodEnd: Date; // access locked once now > currentPeriodEnd
  payments: INcSubscriptionPayment[];
  createdAt: Date;
  updatedAt: Date;
}

const NcSubscriptionPaymentSchema = new Schema<INcSubscriptionPayment>(
  {
    paymentId: { type: String, required: true },
    orderId: { type: String, required: true },
    amountCents: { type: Number, required: true },
    paidAt: { type: Date, default: Date.now },
  },
  { _id: false }
);

const NcSubscriptionSchema = new Schema<INcSubscription>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, unique: true, index: true },
    orgId: { type: Schema.Types.ObjectId, required: true },
    status: { type: String, enum: ["active", "expired", "canceled"], default: "expired" },
    priceCents: { type: Number, default: 4248 },
    currentPeriodStart: { type: Date, default: Date.now },
    currentPeriodEnd: { type: Date, default: Date.now },
    payments: { type: [NcSubscriptionPaymentSchema], default: [] },
  },
  { timestamps: true, collection: "networkchain_subscriptions" }
);

// Model name "NcSubscription" is local to Garage; the collection is NC's.
export const NcSubscription = mongoose.model<INcSubscription>(
  "NcSubscription",
  NcSubscriptionSchema
);
