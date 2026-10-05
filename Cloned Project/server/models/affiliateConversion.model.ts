import { Schema, model, Types } from "mongoose";

// AffiliateConversion: one row per purchase the storefront reports against an
// affiliate ref. Kept SEPARATE from AffiliateClick so conversions never pollute
// click counts and purchases with no tracked click are still captured. This is
// ANALYTICS ONLY — commission payout stays on the referredBy / CombPlan
// pipeline. Idempotent on `orderId` so storefront retries/webhook replays don't
// double-count.
export interface IAffiliateConversion {
  _id: Types.ObjectId;
  affiliateId: string;
  affiliateUserId: Types.ObjectId | null;
  orgId: Types.ObjectId | null;
  itemType:
    | "channel"
    | "product"
    | "office"
    | "course"
    | "workshop"
    | "service"
    | "call";
  itemId: string | null;
  itemName: string;
  sessionId: string | null; // ties back to the originating click
  visitorId: string | null;
  orderId: string | null; // storefront idempotency key
  amount: number;
  currency: string;
  createdAt: Date;
  updatedAt: Date;
}

const AffiliateConversionSchema = new Schema(
  {
    affiliateId: { type: String, required: true, index: true },
    affiliateUserId: { type: Schema.Types.ObjectId, ref: "User", default: null },
    orgId: { type: Schema.Types.ObjectId, ref: "Organization", default: null },
    itemType: {
      type: String,
      enum: ["channel", "product", "office", "course", "workshop", "service", "call"],
      required: true,
    },
    itemId: { type: String, default: null },
    itemName: { type: String, default: "" },
    sessionId: { type: String, default: null },
    visitorId: { type: String, default: null },
    orderId: { type: String, default: null },
    amount: { type: Number, default: 0 },
    currency: { type: String, default: "USD" },
  },
  { timestamps: true },
);

// Idempotency on the storefront's order id (sparse: not every report has one).
AffiliateConversionSchema.index(
  { orderId: 1 },
  { unique: true, sparse: true, name: "conversion_order_unique" },
);
// conversionsToday / per-affiliate listing.
AffiliateConversionSchema.index(
  { affiliateUserId: 1, createdAt: -1 },
  { name: "affiliate_conversions_idx" },
);
// Per-item conversion breakdown.
AffiliateConversionSchema.index(
  { affiliateUserId: 1, itemType: 1, itemId: 1, createdAt: -1 },
  { name: "affiliate_conversion_item_idx" },
);

export const AffiliateConversion = model<IAffiliateConversion>(
  "AffiliateConversion",
  AffiliateConversionSchema,
);
