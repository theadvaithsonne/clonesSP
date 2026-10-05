import { Schema, model, Types } from "mongoose";

// AffiliateClick: one row per click on an affiliate link. Recorded two ways:
//  1. Server-side (adblocker-proof) from GET /affiliate/invite-details, which
//     fires on every landing — a synthetic sessionId dedups reloads.
//  2. Client beacon (POST /affiliate/click) with a real sessionId/visitorId.
// Idempotent on (sessionId, itemId): the unique index collapses a landing
// session to a single doc. Bots are recorded with isBot:true but excluded
// from stats. Never stores a raw IP — only sha256(ip + IP_HASH_SALT).
export interface IAffiliateClick {
  _id: Types.ObjectId;
  sessionId: string;
  affiliateId: string;
  affiliateUserId: Types.ObjectId | null;
  orgId: Types.ObjectId | null;
  itemType:
    | "channel"
    | "product"
    | "office"
    | "store"
    | "course"
    | "workshop"
    | "service"
    | "call"
    | "unknown";
  itemId: string | null;
  itemName: string;
  visitorId: string | null;
  userId: Types.ObjectId | null;
  ipHash: string | null;
  userAgent: string;
  deviceType: string;
  referrerUrl: string;
  isBot: boolean;
  converted: boolean;
  convertedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const AffiliateClickSchema = new Schema(
  {
    sessionId: { type: String, required: true },
    affiliateId: { type: String, required: true, index: true },
    affiliateUserId: { type: Schema.Types.ObjectId, ref: "User", default: null },
    orgId: { type: Schema.Types.ObjectId, ref: "Organization", default: null },
    itemType: {
      type: String,
      enum: [
        "channel",
        "product",
        "office",
        "store",
        "course",
        "workshop",
        "service",
        "call",
        "unknown",
      ],
      default: "unknown",
    },
    itemId: { type: String, default: null },
    itemName: { type: String, default: "" },
    visitorId: { type: String, default: null },
    userId: { type: Schema.Types.ObjectId, ref: "User", default: null },
    ipHash: { type: String, default: null },
    userAgent: { type: String, default: "" },
    deviceType: { type: String, default: "" },
    referrerUrl: { type: String, default: "" },
    isBot: { type: Boolean, default: false },
    converted: { type: Boolean, default: false },
    convertedAt: { type: Date, default: null },
  },
  { timestamps: true },
);

// Dedup a landing session to one doc (server-synthetic or client sessionId).
AffiliateClickSchema.index(
  { sessionId: 1, itemId: 1 },
  { unique: true, name: "click_session_item_unique" },
);
// Clicks Today / per-affiliate listing (Links page is user-centric).
AffiliateClickSchema.index(
  { affiliateUserId: 1, createdAt: -1 },
  { name: "affiliate_clicks_idx" },
);
// Fallback before affiliateId→userId resolution.
AffiliateClickSchema.index(
  { affiliateId: 1, createdAt: -1 },
  { name: "affiliate_code_idx" },
);
// Per-item breakdown for an affiliate.
AffiliateClickSchema.index(
  { affiliateUserId: 1, itemType: 1, itemId: 1, createdAt: -1 },
  { name: "affiliate_item_idx" },
);
// Org-scoped click queries.
AffiliateClickSchema.index(
  { orgId: 1, createdAt: -1 },
  { sparse: true, name: "org_clicks_idx" },
);

export const AffiliateClick = model<IAffiliateClick>(
  "AffiliateClick",
  AffiliateClickSchema,
);
