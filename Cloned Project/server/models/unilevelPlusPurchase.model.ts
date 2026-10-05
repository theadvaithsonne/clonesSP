import { Schema, model, Document, Types } from "mongoose";

export interface IUnilevelPlusPurchase extends Document {
  _id: Types.ObjectId;
  userId: Types.ObjectId;
  planId: Types.ObjectId;
  paymentId: string;
  amount: number;
  currency: string;
  status: "active" | "expired" | "refunded";
  purchasedAt: Date;
  metadata?: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

const UnilevelPlusPurchaseSchema = new Schema(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
    },
    planId: {
      type: Schema.Types.ObjectId,
      ref: "UnilevelPlusPlan",
      required: true,
    },
    paymentId: {
      type: String,
      required: true,
      unique: true,
    },
    amount: {
      type: Number,
      required: true,
      min: 0,
    },
    currency: {
      type: String,
      default: "USD",
    },
    status: {
      type: String,
      enum: ["active", "expired", "refunded"],
      default: "active",
      index: true,
    },
    purchasedAt: {
      type: Date,
      default: Date.now,
    },
    metadata: {
      type: Schema.Types.Mixed,
    },
  },
  { timestamps: true }
);

// Indexes
UnilevelPlusPurchaseSchema.index({ userId: 1, status: 1 });
UnilevelPlusPurchaseSchema.index({ planId: 1, createdAt: -1 });

// ── Admin notifications: "$25 payment" events ───────────────────────────
//
// Hooked on the MODEL rather than on the payment routes because four places
// create a purchase (invoice fulfilment, webhook fallback, direct verify,
// reserve-licence assignment) and emitting per route would miss whichever one
// gets added next — the same trap the User `referredBy` post-hook exists to
// close. Which of those purchases are real payments is decided in
// services/adminNotifications/paymentEvents.ts, not here.
//
// `isNew` is already false by the time post-save runs, so pre-save records it.
// Only the first save of a document emits; later status updates don't.
UnilevelPlusPurchaseSchema.pre("save", function () {
  (this as any).$locals.adminNotifyNew = this.isNew;
});

UnilevelPlusPurchaseSchema.post("save", function (doc: any) {
  if (!doc?.$locals?.adminNotifyNew) return;
  // Off the request path, and never able to throw into it: a notification must
  // not slow down, or fail, the payment that raised it. The dynamic import also
  // avoids a model ↔ service import cycle.
  setImmediate(() => {
    import("../services/adminNotifications/paymentEvents")
      .then((m) => m.emitUp25PaymentEvents(doc))
      .catch((err) => console.error("[AdminNotifications] payment hook failed:", err));
  });
});

export const UnilevelPlusPurchase = model<IUnilevelPlusPurchase>(
  "UnilevelPlusPurchase",
  UnilevelPlusPurchaseSchema
);
